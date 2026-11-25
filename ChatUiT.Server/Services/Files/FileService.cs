using System.Text;
using ChatUiT.Server.Errors;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Encryption;
using ChatUiT.Server.Services.TokenCounting;

namespace ChatUiT.Server.Services.Files;

/// <summary>The original of a file, ready to send to a browser.</summary>
/// <param name="Length">The size in bytes, when known before writing.</param>
public sealed record FileDownload(string FileName, string ContentType, long? Length, Func<Stream, CancellationToken, Task> WriteToAsync);

/// <summary>
/// The files of chats and assistants. An upload is converted in memory and its tokens counted.
/// The database stores the converted content. Reads load the converted content of files in Blob
/// Storage into a file's parts.
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

        var file = await StoreAsync(new ChatFile(), chatId, fileName, contentType, content, cancellationToken);
        if (!await _database.AddMessageFileAsync(userId, chatId, messageId, file))
        {
            throw new FileRequestException(ErrorCodes.MessageNotWaitingForFiles, StatusCodes.Status404NotFound);
        }

        // The chat may have been switched to red while the file was written without a key.
        if (!chat.RedEnabled && await _database.GetChatHeaderAsync(userId, chatId) is { RedEnabled: true })
        {
            await _database.EnableRedAsync(userId, chatId, null);
        }

        return file;
    }

    /// <summary>
    /// Stores and converts a file for an assistant. The returned file has its content loaded
    /// and is not added to the assistant.
    /// </summary>
    /// <exception cref="FileRequestException">The file is refused or cannot be converted.</exception>
    public Task<AssistantFile> StoreAssistantFileAsync(string assistantId, string fileName, string? contentType, Stream content, CancellationToken cancellationToken)
        => StoreAsync(new AssistantFile(), assistantId, fileName, contentType, content, cancellationToken);

    /// <summary>A file on a message of the chat with its content, read from Cosmos or from Blob Storage. Null when the chat has no such file.</summary>
    public async Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId)
    {
        var file = await _database.GetChatFileAsync(userId, chatId, fileId);
        if (file is { IsInBlobStorage: true })
        {
            var chat = await _database.GetChatHeaderAsync(userId, chatId);
            await LoadChatFileContentAsync(userId, chatId, chat?.RedEnabled ?? false, [file]);
        }

        return file;
    }

    /// <summary>A file of the assistant with its content, read from Cosmos or from Blob Storage. Null when the assistant has no such file.</summary>
    public async Task<AssistantFile?> GetAssistantFileAsync(string assistantId, string fileId)
    {
        var file = await _database.GetAssistantFileAsync(assistantId, fileId);
        if (file is { IsInBlobStorage: true })
        {
            await LoadAssistantFileContentAsync(assistantId, [file]);
        }

        return file;
    }

    /// <summary>Loads the converted content of the chat's files that are in Blob Storage into their parts.</summary>
    public async Task LoadChatFileContentAsync(string userId, string chatId, bool redEnabled, IEnumerable<ChatFile> files)
    {
        var blobFiles = files.Where(file => file.IsInBlobStorage).ToList();
        if (blobFiles.Count == 0)
        {
            return;
        }

        var key = redEnabled || blobFiles.Any(file => file.IsEncrypted) ? await _chatKeys.GetUserKeyAsync(userId) : null;
        await LoadContentAsync(chatId, blobFiles, key);
    }

    /// <summary>Loads the converted content of the assistant's files that are in Blob Storage into their parts.</summary>
    public Task LoadAssistantFileContentAsync(string assistantId, IEnumerable<ChatFile> files)
        => LoadContentAsync(assistantId, files.Where(file => file.IsInBlobStorage).ToList(), key: null);

    /// <summary>Deletes the blobs of the files that are in Blob Storage.</summary>
    public async Task DeleteFilesAsync(string ownerId, IEnumerable<ChatFile> files)
    {
        foreach (var file in files.Where(file => file.IsInBlobStorage))
        {
            await _store.DeleteFileAsync(ownerId, file.SourceFilename, CancellationToken.None);
        }
    }

    /// <summary>Deletes every blob of a chat or an assistant.</summary>
    public Task DeleteAllAsync(string ownerId) => _store.DeleteAllAsync(ownerId, CancellationToken.None);

    /// <summary>Encrypts every blob of the chat that is not encrypted yet, and marks the chat's files as encrypted.</summary>
    public async Task EncryptChatFilesAsync(string userId, string chatId)
    {
        await _store.EncryptAllAsync(chatId, await _chatKeys.GetUserKeyAsync(userId), CancellationToken.None);
        await _database.MarkChatFilesEncryptedAsync(userId, chatId);
    }

    // Switched off in stage 1: serving a file's original for preview and download. The
    // endpoints that call these are commented out in ChatsController and AssistantsController.

    /// <summary>The original of a chat file. Null when the chat has no such file.</summary>
    /// <exception cref="FileRequestException">The file is stored in Cosmos and is neither only text nor a single image.</exception>
    public async Task<FileDownload?> OpenChatFileAsync(string userId, string chatId, string fileId)
    {
        var file = await _database.GetChatFileAsync(userId, chatId, fileId);
        if (file == null)
        {
            return null;
        }

        if (!file.IsInBlobStorage)
        {
            return FromCosmosContent(file);
        }

        var key = file.IsEncrypted || await _database.GetChatHeaderAsync(userId, chatId) is { RedEnabled: true }
            ? await _chatKeys.GetUserKeyAsync(userId)
            : null;
        return FromBlob(chatId, file, key);
    }

    /// <summary>The original of an assistant file. Null when the assistant has no such file.</summary>
    /// <exception cref="FileRequestException">The file is stored in Cosmos and is neither only text nor a single image.</exception>
    public async Task<FileDownload?> OpenAssistantFileAsync(string assistantId, string fileId)
    {
        var file = await _database.GetAssistantFileAsync(assistantId, fileId);
        if (file == null)
        {
            return null;
        }

        return file.IsInBlobStorage ? FromBlob(assistantId, file, key: null) : FromCosmosContent(file);
    }

    private async Task LoadContentAsync(string ownerId, IReadOnlyList<ChatFile> files, byte[]? key)
    {
        await Task.WhenAll(files.Select(async file =>
        {
            var converted = await _store.ReadConvertedAsync(ownerId, file.SourceFilename, key, CancellationToken.None);
            file.Chunks = converted?.ToChunks() ?? [];
        }));
    }

    private async Task<T> StoreAsync<T>(T file, string ownerId, string fileName, string? contentType, Stream content, CancellationToken cancellationToken)
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
            return await StoreInSlotAsync(file, kind, fileName, content, cancellationToken);
        }
        finally
        {
            _uploadSlots.Release();
        }
    }

    private async Task<T> StoreInSlotAsync<T>(T file, FileKind kind, string fileName, Stream content, CancellationToken cancellationToken)
        where T : ChatFile
    {
        using var local = new MemoryStream();
        var buffer = new byte[81_920];
        int read;
        while ((read = await content.ReadAsync(buffer, cancellationToken)) > 0)
        {
            if (local.Length + read > FileKinds.MaxFileBytes)
            {
                throw new FileRequestException(ErrorCodes.FileTooLarge, StatusCodes.Status413PayloadTooLarge);
            }

            local.Write(buffer, 0, read);
        }

        ConvertedFile converted;
        try
        {
            local.Position = 0;
            converted = await _converter.ConvertAsync(kind, local, cancellationToken);
        }
        catch (FileConversionException ex)
        {
            throw new FileRequestException(ex.Error, innerException: ex);
        }

        file.SourceFilename = fileName;
        file.Chunks = converted.ToChunks();
        file.TokenCounts = _tokenCounting.CountFile(file, await _tokenCounting.GetActiveSchemeIdsAsync());
        return file;
    }

    private FileDownload FromBlob(string ownerId, ChatFile file, byte[]? key) => new(
        file.SourceFilename,
        file.ContentType,
        file.Size,
        async (destination, cancellationToken) =>
        {
            if (!await _store.CopyOriginalToAsync(ownerId, file.SourceFilename, key, destination, cancellationToken))
            {
                throw new FileNotFoundException($"The original of file {file.Id} is missing in Blob Storage.");
            }
        });

    /// <summary>A file stored in Cosmos has no original: its text, or its single image, is served in its place.</summary>
    private static FileDownload FromCosmosContent(ChatFile file)
    {
        byte[] bytes;
        string contentType;
        string extension;
        switch (FilePreviews.KindOf(file))
        {
            case FilePreviews.Text or FilePreviews.Markdown:
                bytes = Encoding.UTF8.GetBytes(string.Concat(file.Chunks.Select(chunk => chunk.Text)));
                contentType = "text/plain; charset=utf-8";
                extension = ".txt";
                break;
            case FilePreviews.Image:
                bytes = file.Chunks[0].Data ?? [];
                contentType = MessageParts.ResolveMediaType(file.Chunks[0].Format);
                extension = contentType == "image/png" ? ".png" : ".jpg";
                break;
            default:
                throw new FileRequestException(ErrorCodes.FilePreviewNotAvailable, StatusCodes.Status404NotFound);
        }

        var fileName = FilePreviews.ServedAsIs(file.SourceFilename, extension) ? file.SourceFilename : file.SourceFilename + extension;
        return new FileDownload(fileName, contentType, bytes.Length, (destination, cancellationToken) => destination.WriteAsync(bytes, cancellationToken).AsTask());
    }
}
