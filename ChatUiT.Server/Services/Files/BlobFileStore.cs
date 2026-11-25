using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Encryption;

namespace ChatUiT.Server.Services.Files;

/// <summary>Thrown when an upload is larger than the limit it was given.</summary>
public sealed class FileTooLargeException() : Exception("The file is larger than the limit.");

/// <summary>
/// The files of one chat or assistant in its own blob container, named after its id. An original
/// is stored at <c>input/{name}</c>. Its converted content is stored under <c>converted/{name}/</c>:
/// <c>manifest.json</c>, which lists the parts in order, and <c>image-{n}.jpg</c> for each image.
/// Every blob of an encrypted file has <c>.enc</c> added to its name and is encrypted with
/// <see cref="SegmentedCipher"/>. Blobs carry no metadata: what a file is lies in its
/// <see cref="ChatFile"/>.
/// </summary>
public sealed partial class BlobFileStore
{
    private const string InputPrefix = "input/";
    private const string ConvertedPrefix = "converted/";
    private const string ManifestName = "manifest.json";
    private const string EncryptedEnding = ".enc";
    private const int MaxNameLength = 200;

    /// <summary>How many names an original is tried under before the upload fails.</summary>
    private const int MaxNameTries = 1000;

    private readonly IBlobStorage _blobs;

    public BlobFileStore(IBlobStorage blobs)
    {
        _blobs = blobs;
    }

    /// <summary>A container name is 3 to 63 characters: lowercase letters, numbers and single hyphens, starting and ending with a letter or number.</summary>
    public static bool IsValidOwnerId(string ownerId) => ContainerName().IsMatch(ownerId);

    [GeneratedRegex("^(?=.{3,63}$)[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex ContainerName();

    /// <summary>
    /// Stores an original under the first free name: <paramref name="fileName"/>, else the name with
    /// " (2)", " (3)" and so on before the extension, up to <see cref="MaxNameTries"/> names. With a
    /// key the original is encrypted. Returns the name used and the size.
    /// </summary>
    /// <exception cref="FileTooLargeException">The content is longer than <paramref name="maxBytes"/>. Nothing is kept.</exception>
    public async Task<(string Name, long Size)> WriteOriginalAsync(string ownerId, string fileName, Stream content, long maxBytes, byte[]? key, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        await _blobs.EnsureContainerAsync(container, cancellationToken);
        var encrypted = key != null;
        var name = await ReserveNameAsync(container, CleanName(fileName), encrypted, cancellationToken);
        var blob = BlobName(InputPrefix + name, encrypted);

        var limited = new LimitedReadStream(content, maxBytes);
        try
        {
            await WriteAsync(container, blob, limited, key, cancellationToken);
        }
        catch
        {
            await _blobs.DeleteAsync(container, blob, CancellationToken.None);
            throw;
        }

        return (name, limited.BytesRead);
    }

    /// <summary>The stored original of <paramref name="file"/>, encrypted for an encrypted file. Null when it does not exist.</summary>
    public Task<Stream?> OpenOriginalAsync(string ownerId, ChatFile file, CancellationToken cancellationToken)
        => _blobs.OpenReadAsync(Container(ownerId), BlobName(InputPrefix + file.SourceFilename, file.IsEncrypted), cancellationToken);

    /// <summary>Writes an original from <see cref="OpenOriginalAsync"/> to <paramref name="destination"/>, decrypted with the key for an encrypted file.</summary>
    public static async Task CopyOriginalAsync(Stream original, ChatFile file, byte[]? key, Stream destination, CancellationToken cancellationToken)
    {
        if (!file.IsEncrypted)
        {
            await original.CopyToAsync(destination, cancellationToken);
            return;
        }

        if (key == null)
        {
            throw new CryptographicException("An encrypted file was read without the owner's key.");
        }

        await SegmentedCipher.DecryptAsync(key, original, destination, cancellationToken);
    }

    /// <summary>
    /// Stores the content of <paramref name="file"/>'s chunks as its converted content. With a key
    /// every blob is encrypted.
    /// </summary>
    public async Task WriteConvertedAsync(string ownerId, ChatFile file, byte[]? key, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        var folder = ConvertedFolder(file.SourceFilename);
        var encrypted = key != null;
        var manifest = new List<string>(file.Chunks.Count);
        var imageNumber = 0;

        foreach (var chunk in file.Chunks)
        {
            if (chunk.IsImage)
            {
                var image = ImageName(++imageNumber);
                await WriteAsync(container, BlobName(folder + image, encrypted), new MemoryStream(chunk.Data ?? []), key, cancellationToken);
                manifest.Add(image);
            }
            else
            {
                manifest.Add(chunk.Text ?? string.Empty);
            }
        }

        await WriteAsync(container, BlobName(folder + ManifestName, encrypted), new MemoryStream(JsonSerializer.SerializeToUtf8Bytes(manifest)), key, cancellationToken);
    }

    /// <summary>
    /// Loads the converted content into <paramref name="file"/>'s chunks: the text of each text
    /// chunk and the bytes of each image chunk. A chunk whose content is missing reads as empty.
    /// </summary>
    public async Task ReadConvertedAsync(string ownerId, ChatFile file, byte[]? key, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        var folder = ConvertedFolder(file.SourceFilename);
        var manifestBytes = await ReadAsync(container, BlobName(folder + ManifestName, file.IsEncrypted), key, cancellationToken);
        var manifest = manifestBytes == null ? [] : JsonSerializer.Deserialize<List<string>>(manifestBytes) ?? [];
        if (manifest.Count != file.Chunks.Count)
        {
            manifest = [];
        }

        for (var index = 0; index < file.Chunks.Count; index++)
        {
            var chunk = file.Chunks[index];
            var part = index < manifest.Count ? manifest[index] : null;
            if (chunk.IsImage)
            {
                chunk.Data = (part == null ? null : await ReadAsync(container, BlobName(folder + part, file.IsEncrypted), key, cancellationToken)) ?? [];
            }
            else
            {
                chunk.Text = part ?? string.Empty;
            }
        }
    }

    /// <summary>Deletes the original and the converted content, encrypted or not.</summary>
    public async Task DeleteFileAsync(string ownerId, string name, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        var converted = new List<string>();
        await foreach (var blob in _blobs.ListAsync(container, ConvertedFolder(name), cancellationToken))
        {
            converted.Add(blob);
        }

        foreach (var blob in converted)
        {
            await _blobs.DeleteAsync(container, blob, cancellationToken);
        }

        await _blobs.DeleteAsync(container, InputPrefix + name, cancellationToken);
        await _blobs.DeleteAsync(container, InputPrefix + name + EncryptedEnding, cancellationToken);
    }

    /// <summary>Deletes the container with everything in it.</summary>
    public Task DeleteAllAsync(string ownerId, CancellationToken cancellationToken)
        => IsValidOwnerId(ownerId) ? _blobs.DeleteContainerAsync(ownerId, cancellationToken) : Task.CompletedTask;

    /// <summary>
    /// Writes an encrypted copy of each unencrypted blob of the file, under its name with
    /// <c>.enc</c> added. Returns the names of the copies written.
    /// </summary>
    public async Task<List<string>> WriteEncryptedCopiesAsync(string ownerId, string name, byte[] key, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        var written = new List<string>();
        foreach (var blob in await UnencryptedBlobsAsync(container, name, cancellationToken))
        {
            await using var content = await _blobs.OpenReadAsync(container, blob, cancellationToken);
            if (content != null)
            {
                await WriteAsync(container, blob + EncryptedEnding, content, key, cancellationToken);
                written.Add(blob + EncryptedEnding);
            }
        }

        return written;
    }

    /// <summary>Deletes the named blobs.</summary>
    public async Task DeleteBlobsAsync(string ownerId, IEnumerable<string> names, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        foreach (var name in names)
        {
            await _blobs.DeleteAsync(container, name, cancellationToken);
        }
    }

    /// <summary>Deletes the unencrypted blobs of the file.</summary>
    public async Task DeleteUnencryptedAsync(string ownerId, string name, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        foreach (var blob in await UnencryptedBlobsAsync(container, name, cancellationToken))
        {
            await _blobs.DeleteAsync(container, blob, cancellationToken);
        }
    }

    private async Task<List<string>> UnencryptedBlobsAsync(string container, string name, CancellationToken cancellationToken)
    {
        var blobs = new List<string>();
        if (await _blobs.ExistsAsync(container, InputPrefix + name, cancellationToken))
        {
            blobs.Add(InputPrefix + name);
        }

        await foreach (var blob in _blobs.ListAsync(container, ConvertedFolder(name), cancellationToken))
        {
            if (!blob.EndsWith(EncryptedEnding, StringComparison.Ordinal))
            {
                blobs.Add(blob);
            }
        }

        return blobs;
    }

    private static string Container(string ownerId)
        => IsValidOwnerId(ownerId) ? ownerId : throw new ArgumentException($"'{ownerId}' cannot name a blob container.", nameof(ownerId));

    private static string ConvertedFolder(string name) => $"{ConvertedPrefix}{name}/";

    private static string ImageName(int number) => $"image-{number}.jpg";

    private static string BlobName(string name, bool encrypted) => encrypted ? name + EncryptedEnding : name;

    /// <summary>The file name without folders or control characters, and at most <see cref="MaxNameLength"/> characters.</summary>
    private static string CleanName(string fileName)
    {
        var name = fileName.Replace('\\', '/');
        name = name[(name.LastIndexOf('/') + 1)..];
        name = new string(name.Where(c => !char.IsControl(c)).ToArray()).Trim().TrimEnd('.');
        if (name.Length == 0)
        {
            return "file";
        }

        if (name.Length > MaxNameLength)
        {
            var extension = Path.GetExtension(name);
            extension = extension.Length <= 20 ? extension : string.Empty;
            name = name[..(MaxNameLength - extension.Length)] + extension;
        }

        return name;
    }

    /// <summary>
    /// Takes the first name that is free both unencrypted and encrypted, by creating an empty
    /// original under the name the file is written to.
    /// </summary>
    private async Task<string> ReserveNameAsync(string container, string name, bool encrypted, CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(name);
        var stem = name[..(name.Length - extension.Length)];
        for (var number = 1; number <= MaxNameTries; number++)
        {
            var candidate = number == 1 ? name : $"{stem} ({number}){extension}";
            var reserved = BlobName(InputPrefix + candidate, encrypted);
            var other = BlobName(InputPrefix + candidate, !encrypted);
            if (await _blobs.ExistsAsync(container, other, cancellationToken)
                || !await _blobs.TryCreateEmptyAsync(container, reserved, cancellationToken))
            {
                continue;
            }

            if (!await _blobs.ExistsAsync(container, other, cancellationToken))
            {
                return candidate;
            }

            await _blobs.DeleteAsync(container, reserved, cancellationToken);
        }

        throw new InvalidOperationException($"No free name for '{name}' after {MaxNameTries} tries.");
    }

    private async Task WriteAsync(string container, string blobName, Stream content, byte[]? key, CancellationToken cancellationToken)
    {
        await using var output = await _blobs.OpenWriteAsync(container, blobName, cancellationToken);
        if (key == null)
        {
            await content.CopyToAsync(output, cancellationToken);
        }
        else
        {
            await SegmentedCipher.EncryptAsync(key, content, output, cancellationToken);
        }
    }

    /// <summary>Null when the blob does not exist. A name ending in <c>.enc</c> is decrypted with the key.</summary>
    private async Task<byte[]?> ReadAsync(string container, string blobName, byte[]? key, CancellationToken cancellationToken)
    {
        await using var content = await _blobs.OpenReadAsync(container, blobName, cancellationToken);
        if (content == null)
        {
            return null;
        }

        var buffer = new MemoryStream();
        if (!blobName.EndsWith(EncryptedEnding, StringComparison.Ordinal))
        {
            await content.CopyToAsync(buffer, cancellationToken);
            return buffer.ToArray();
        }

        if (key == null)
        {
            throw new CryptographicException("An encrypted file was read without the owner's key.");
        }

        await SegmentedCipher.DecryptAsync(key, content, buffer, cancellationToken);
        return buffer.ToArray();
    }

    /// <summary>Reads from a stream and throws <see cref="FileTooLargeException"/> past the limit.</summary>
    private sealed class LimitedReadStream(Stream inner, long maxBytes) : Stream
    {
        public long BytesRead { get; private set; }

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => BytesRead; set => throw new NotSupportedException(); }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
            => Count(await inner.ReadAsync(buffer, cancellationToken));

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

        public override int Read(byte[] buffer, int offset, int count) => Count(inner.Read(buffer, offset, count));

        private int Count(int read)
        {
            BytesRead += read;
            return BytesRead > maxBytes ? throw new FileTooLargeException() : read;
        }

        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
