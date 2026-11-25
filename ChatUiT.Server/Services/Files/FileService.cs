using ChatUiT.Server.Errors;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Encryption;
using ChatUiT.Server.Services.TokenCounting;

namespace ChatUiT.Server.Services.Files;

/// <summary>The original of a file, ready to send to a browser.</summary>
/// <param name="Length">The size in bytes, when known before writing.</param>
public sealed record FileDownload(string FileName, string ContentType, long? Length, Func<Stream, CancellationToken, Task> WriteToAsync);

/// <summary>
/// The files of chats and assistants in Blob Storage. An upload stores the original, converts
/// it, stores the converted content and counts its tokens. In a red chat everything is encrypted
/// with the owner's key. Reads load the converted content into a file's chunks.
/// </summary>
public sealed class FileService
{
    private readonly BlobFileStore _store;
    private readonly FileConversionService _converter;
    private readonly IDatabaseService _database;
    private readonly IChatKeyService _chatKeys;
    private readonly ITokenCountingService _tokenCounting;

    // An upload is held in memory until it is converted. At most one upload per CPU core is
    // held at a time. The rest wait before their content is read.
    private readonly SemaphoreSlim _uploadSlots = new(Environment.ProcessorCount, Environment.ProcessorCount);

    public FileService(
        BlobFileStore store,
        FileConversionService converter,
        IDatabaseService database,
        IChatKeyService chatKeys,
        ITokenCountingService tokenCounting)
    {
        _store = store;
        _converter = converter;
        _database = database;
        _chatKeys = chatKeys;
        _tokenCounting = tokenCounting;
    }

    /// <summary>
    /// Uploads a file to a message that is not sent yet (status New) and adds it to the message.
    /// The returned file has its content loaded.
    /// </summary>
    /// <exception cref="FileRequestException">The chat has no such message, or the file is refused or cannot be converted.</exception>
    public async Task<ChatFile> UploadChatFileAsync(string userId, string chatId, string messageId, string fileName, string? contentType, Stream content, CancellationToken cancellationToken)
    {
        var chat = await _database.GetChatHeaderAsync(userId, chatId)
            ?? throw new FileRequestException(ErrorCodes.ChatNotFound, StatusCodes.Status404NotFound);
        if (await _database.GetMessageAsync(userId, chatId, messageId) is not { Status: AiChatStatus.New })
        {
            throw new FileRequestException(ErrorCodes.MessageNotWaitingForFiles, StatusCodes.Status404NotFound);
        }

        var key = chat.RedEnabled ? await _chatKeys.GetUserKeyAsync(userId) : null;
        var file = await StoreAsync(new ChatFile(), chatId, fileName, contentType, content, key, cancellationToken);
        try
        {
            if (!await _database.AddMessageFileAsync(userId, chatId, messageId, file))
            {
                throw new FileRequestException(ErrorCodes.MessageNotWaitingForFiles, StatusCodes.Status404NotFound);
            }
        }
        catch
        {
            // A file that is not added to the message leaves no blobs behind.
            await _store.DeleteFileAsync(chatId, file.SourceFilename, CancellationToken.None);
            throw;
        }

        // The chat may have been switched to red while the file was written without a key.
        if (key == null && await _database.GetChatHeaderAsync(userId, chatId) is { RedEnabled: true })
        {
            await EncryptChatFileAsync(userId, chatId, messageId, file, await _chatKeys.GetUserKeyAsync(userId));
        }

        return file;
    }

    /// <summary>
    /// Stores and converts a file for an assistant. The returned file has its content loaded
    /// and is not added to the assistant.
    /// </summary>
    /// <exception cref="FileRequestException">The file is refused or cannot be converted.</exception>
    public Task<AssistantFile> StoreAssistantFileAsync(string assistantId, string fileName, string? contentType, Stream content, CancellationToken cancellationToken)
        => StoreAsync(new AssistantFile(), assistantId, fileName, contentType, content, key: null, cancellationToken);

    /// <summary>A file on a message of the chat with its content. Null when the chat has no such file.</summary>
    public async Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId)
    {
        var file = await _database.GetChatFileAsync(userId, chatId, fileId);
        if (file != null)
        {
            await LoadChatFileContentAsync(userId, chatId, [file]);
        }

        return file;
    }

    /// <summary>A file of the assistant with its content. Null when the assistant has no such file.</summary>
    public async Task<AssistantFile?> GetAssistantFileAsync(string assistantId, string fileId)
    {
        var file = await _database.GetAssistantFileAsync(assistantId, fileId);
        if (file != null)
        {
            await LoadAssistantFileContentAsync(assistantId, [file]);
        }

        return file;
    }

    /// <summary>Loads the converted content of the chat's files whose content is not loaded.</summary>
    public async Task LoadChatFileContentAsync(string userId, string chatId, IEnumerable<ChatFile> files)
    {
        var unloaded = files.Where(file => !file.IsContentLoaded).ToList();
        if (unloaded.Count == 0)
        {
            return;
        }

        var key = unloaded.Any(file => file.IsEncrypted) ? await _chatKeys.GetUserKeyAsync(userId) : null;
        await LoadContentAsync(chatId, unloaded, key);
    }

    /// <summary>Loads the converted content of the assistant's files whose content is not loaded, as <see cref="LoadChatFileContentAsync"/>.</summary>
    public Task LoadAssistantFileContentAsync(string assistantId, IEnumerable<ChatFile> files)
        => LoadContentAsync(assistantId, files.Where(file => !file.IsContentLoaded).ToList(), key: null);

    /// <summary>Deletes the blobs of the files.</summary>
    public async Task DeleteFilesAsync(string ownerId, IEnumerable<ChatFile> files)
    {
        foreach (var file in files)
        {
            await _store.DeleteFileAsync(ownerId, file.SourceFilename, CancellationToken.None);
        }
    }

    /// <summary>Deletes every blob of a chat or an assistant.</summary>
    public Task DeleteAllAsync(string ownerId) => _store.DeleteAllAsync(ownerId, CancellationToken.None);

    /// <summary>
    /// Encrypts every file of the chat that is not encrypted yet, and deletes the
    /// unencrypted blobs an earlier run left behind for encrypted files.
    /// </summary>
    public async Task EncryptChatFilesAsync(string userId, string chatId)
    {
        var files = await _database.GetChatFilesAsync(userId, chatId);
        if (files.Count == 0)
        {
            return;
        }

        var key = await _chatKeys.GetUserKeyAsync(userId);
        foreach (var (messageId, file) in files)
        {
            if (file.IsEncrypted)
            {
                await _store.DeleteUnencryptedAsync(chatId, file.SourceFilename, CancellationToken.None);
            }
            else
            {
                await EncryptChatFileAsync(userId, chatId, messageId, file, key);
            }
        }
    }

    /// <summary>
    /// Writes an encrypted copy of each blob of the file, marks the file encrypted, then deletes
    /// the unencrypted blobs. Run again after a stop, it finishes what is left.
    /// </summary>
    private async Task EncryptChatFileAsync(string userId, string chatId, string messageId, ChatFile file, byte[] key)
    {
        var copies = await _store.WriteEncryptedCopiesAsync(chatId, file.SourceFilename, key, CancellationToken.None);
        if (await _database.MarkChatFileEncryptedAsync(userId, chatId, messageId, file.Id))
        {
            file.IsEncrypted = true;
            await _store.DeleteUnencryptedAsync(chatId, file.SourceFilename, CancellationToken.None);
        }
        else
        {
            // The file was removed from its message during the switch.
            await _store.DeleteBlobsAsync(chatId, copies, CancellationToken.None);
        }
    }

    /// <summary>The original of a chat file. Null when the chat has no such file.</summary>
    /// <exception cref="FileRequestException">The file has no original.</exception>
    public async Task<FileDownload?> OpenChatFileAsync(string userId, string chatId, string fileId)
    {
        var file = await _database.GetChatFileAsync(userId, chatId, fileId);
        if (file == null)
        {
            return null;
        }

        var key = file.IsEncrypted ? await _chatKeys.GetUserKeyAsync(userId) : null;
        return await OpenOriginalAsync(chatId, file, key);
    }

    /// <summary>The original of an assistant file. Null when the assistant has no such file.</summary>
    /// <exception cref="FileRequestException">The file has no original.</exception>
    public async Task<FileDownload?> OpenAssistantFileAsync(string assistantId, string fileId)
    {
        var file = await _database.GetAssistantFileAsync(assistantId, fileId);
        return file == null ? null : await OpenOriginalAsync(assistantId, file, key: null);
    }

    private async Task LoadContentAsync(string ownerId, IReadOnlyList<ChatFile> files, byte[]? key)
    {
        await Task.WhenAll(files.Select(file => _store.ReadConvertedAsync(ownerId, file, key, CancellationToken.None)));
    }

    private async Task<T> StoreAsync<T>(T file, string ownerId, string fileName, string? contentType, Stream content, byte[]? key, CancellationToken cancellationToken)
        where T : ChatFile
    {
        var kind = FileKinds.Resolve(fileName, contentType)
            ?? throw new FileRequestException(ErrorCodes.FileTypeNotSupported);
        if (!BlobFileStore.IsValidOwnerId(ownerId))
        {
            throw new FileRequestException(ErrorCodes.FileOwnerIdInvalid);
        }

        await _uploadSlots.WaitAsync(cancellationToken);
        try
        {
            return await StoreInSlotAsync(file, ownerId, kind, fileName, contentType, content, key, cancellationToken);
        }
        finally
        {
            _uploadSlots.Release();
        }
    }

    private async Task<T> StoreInSlotAsync<T>(T file, string ownerId, FileKind kind, string fileName, string? contentType, Stream content, byte[]? key, CancellationToken cancellationToken)
        where T : ChatFile
    {
        // The upload is written to Blob Storage and kept in memory at once. The converter reads it from memory.
        using var local = new MemoryStream();

        string name;
        long size;
        try
        {
            (name, size) = await _store.WriteOriginalAsync(ownerId, fileName, new CopyingReadStream(content, local), FileKinds.MaxFileBytes, key, cancellationToken);
        }
        catch (FileTooLargeException ex)
        {
            throw new FileRequestException(ErrorCodes.FileTooLarge, StatusCodes.Status413PayloadTooLarge, ex);
        }

        file.SourceFilename = name;
        file.Size = size;
        file.ContentType = FileKinds.ContentTypeOf(name, contentType);
        file.IsEncrypted = key != null;

        try
        {
            local.Position = 0;
            var converted = await _converter.ConvertAsync(kind, local, cancellationToken);
            file.Chunks = converted.ToChunks();
            await _store.WriteConvertedAsync(ownerId, file, key, cancellationToken);
        }
        catch (Exception ex)
        {
            await _store.DeleteFileAsync(ownerId, name, CancellationToken.None);
            throw ex is FileConversionException conversion ? new FileRequestException(conversion.Error, innerException: ex) : ex;
        }

        file.TokenCounts = _tokenCounting.CountFile(file, await _tokenCounting.GetActiveSchemeIdsAsync());
        return file;
    }

    /// <exception cref="FileRequestException">The file has no original.</exception>
    private async Task<FileDownload> OpenOriginalAsync(string ownerId, ChatFile file, byte[]? key)
    {
        var original = await _store.OpenOriginalAsync(ownerId, file, CancellationToken.None)
            ?? throw new FileRequestException(ErrorCodes.FilePreviewNotAvailable, StatusCodes.Status404NotFound);

        return new FileDownload(
            file.SourceFilename,
            file.ContentType,
            file.Size,
            async (destination, cancellationToken) =>
            {
                await using (original)
                {
                    await BlobFileStore.CopyOriginalAsync(original, file, key, destination, cancellationToken);
                }
            });
    }

    /// <summary>Reads from a stream and writes everything read to another stream.</summary>
    private sealed class CopyingReadStream(Stream inner, Stream copy) : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            var read = await inner.ReadAsync(buffer, cancellationToken);
            await copy.WriteAsync(buffer[..read], cancellationToken);
            return read;
        }

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

        public override int Read(byte[] buffer, int offset, int count)
        {
            var read = inner.Read(buffer, offset, count);
            copy.Write(buffer, offset, read);
            return read;
        }

        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
