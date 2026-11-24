using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ChatUiT.Server.Services.Encryption;

namespace ChatUiT.Server.Services.Files;

/// <summary>Thrown when an upload is larger than the limit it was given.</summary>
public sealed class FileTooLargeException() : Exception("The file is larger than the limit.");

/// <summary>
/// The files of one chat or assistant in its own blob container, named after its id. An original
/// is stored at <c>input/{name}</c>. Its converted content is stored under <c>converted/{name}/</c>:
/// a manifest that lists the text and image parts in order, and one blob per image. Blobs written
/// with a key are encrypted with <see cref="SegmentedCipher"/> and carry the metadata
/// <c>encrypted=true</c>.
/// </summary>
public sealed partial class BlobFileStore
{
    private const string InputPrefix = "input/";
    private const string ConvertedPrefix = "converted/";
    private const string ManifestName = "manifest.json";
    private const string EncryptedKey = "encrypted";
    private const int MaxNameLength = 200;

    /// <summary>How many names an original is tried under before the upload fails.</summary>
    private const int MaxNameTries = 1000;

    private static readonly JsonSerializerOptions ManifestJson = new(JsonSerializerDefaults.Web);

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
    /// " (2)", " (3)" and so on before the extension, up to <see cref="MaxNameTries"/> names.
    /// Returns the name used and the size.
    /// </summary>
    /// <exception cref="FileTooLargeException">The content is longer than <paramref name="maxBytes"/>. Nothing is kept.</exception>
    public async Task<(string Name, long Size)> WriteOriginalAsync(string ownerId, string fileName, Stream content, long maxBytes, byte[]? key, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        await _blobs.EnsureContainerAsync(container, cancellationToken);
        var name = await ReserveNameAsync(container, CleanName(fileName), cancellationToken);

        var limited = new LimitedReadStream(content, maxBytes);
        try
        {
            await WriteAsync(container, InputPrefix + name, limited, key, cancellationToken);
        }
        catch
        {
            await _blobs.DeleteAsync(container, InputPrefix + name, CancellationToken.None);
            throw;
        }

        return (name, limited.BytesRead);
    }

    /// <summary>Writes the original to <paramref name="destination"/>. False when it does not exist.</summary>
    public Task<bool> CopyOriginalToAsync(string ownerId, string name, byte[]? key, Stream destination, CancellationToken cancellationToken)
        => CopyToAsync(Container(ownerId), InputPrefix + name, key, destination, cancellationToken);

    public async Task WriteConvertedAsync(string ownerId, string name, ConvertedFile converted, byte[]? key, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        var folder = ConvertedFolder(name);
        var parts = new List<ManifestPart>(converted.Parts.Count);
        var imageNumber = 0;

        foreach (var part in converted.Parts)
        {
            switch (part)
            {
                case ConvertedText text:
                    parts.Add(new ManifestPart { Type = "text", Text = text.Text, Format = text.Format });
                    break;
                case ConvertedImage image:
                    var blob = $"image-{++imageNumber}{Extension(image.MediaType)}";
                    await WriteAsync(container, folder + blob, new MemoryStream(image.Data), key, cancellationToken);
                    parts.Add(new ManifestPart { Type = "image", Blob = blob, MediaType = image.MediaType, Width = image.Width, Height = image.Height });
                    break;
            }
        }

        var manifest = JsonSerializer.SerializeToUtf8Bytes(new Manifest { Parts = parts }, ManifestJson);
        await WriteAsync(container, folder + ManifestName, new MemoryStream(manifest), key, cancellationToken);
    }

    /// <summary>Null when the file has no converted content.</summary>
    public async Task<ConvertedFile?> ReadConvertedAsync(string ownerId, string name, byte[]? key, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        var folder = ConvertedFolder(name);
        var manifestBytes = await ReadAsync(container, folder + ManifestName, key, cancellationToken);
        if (manifestBytes == null)
        {
            return null;
        }

        var manifest = JsonSerializer.Deserialize<Manifest>(manifestBytes, ManifestJson) ?? new Manifest();
        var parts = new List<ConvertedPart>(manifest.Parts.Count);
        foreach (var part in manifest.Parts)
        {
            if (part.Type == "text")
            {
                parts.Add(new ConvertedText(part.Text ?? string.Empty, part.Format ?? "plain"));
            }
            else if (part.Type == "image" && part.Blob != null)
            {
                var data = await ReadAsync(container, folder + part.Blob, key, cancellationToken)
                    ?? throw new InvalidOperationException($"Converted image {part.Blob} of {name} is missing.");
                parts.Add(new ConvertedImage(data, part.MediaType ?? "image/jpeg", part.Width, part.Height));
            }
        }

        return new ConvertedFile(parts);
    }

    /// <summary>Deletes the original and its converted content.</summary>
    public async Task DeleteFileAsync(string ownerId, string name, CancellationToken cancellationToken)
    {
        var container = Container(ownerId);
        var converted = new List<string>();
        await foreach (var blob in _blobs.ListAsync(container, ConvertedFolder(name), cancellationToken))
        {
            converted.Add(blob.Name);
        }

        foreach (var blob in converted)
        {
            await _blobs.DeleteAsync(container, blob, cancellationToken);
        }

        await _blobs.DeleteAsync(container, InputPrefix + name, cancellationToken);
    }

    /// <summary>Deletes the container with everything in it.</summary>
    public Task DeleteAllAsync(string ownerId, CancellationToken cancellationToken)
        => IsValidOwnerId(ownerId) ? _blobs.DeleteContainerAsync(ownerId, cancellationToken) : Task.CompletedTask;

    /// <summary>Encrypts every blob of the container that is not encrypted yet.</summary>
    public async Task EncryptAllAsync(string ownerId, byte[] key, CancellationToken cancellationToken)
    {
        if (!IsValidOwnerId(ownerId))
        {
            return;
        }

        var plain = new List<string>();
        await foreach (var blob in _blobs.ListAsync(ownerId, string.Empty, cancellationToken))
        {
            if (!IsEncrypted(blob.Metadata))
            {
                plain.Add(blob.Name);
            }
        }

        foreach (var name in plain)
        {
            await using var content = await _blobs.OpenReadAsync(ownerId, name, cancellationToken);
            if (content != null && !IsEncrypted(content.Metadata))
            {
                await WriteAsync(ownerId, name, content.Stream, key, cancellationToken);
            }
        }
    }

    private static string Container(string ownerId)
        => IsValidOwnerId(ownerId) ? ownerId : throw new ArgumentException($"'{ownerId}' cannot name a blob container.", nameof(ownerId));

    private static string ConvertedFolder(string name) => $"{ConvertedPrefix}{name}/";

    private static bool IsEncrypted(IReadOnlyDictionary<string, string> metadata)
        => metadata.TryGetValue(EncryptedKey, out var value) && value == "true";

    private static string Extension(string mediaType) => mediaType switch
    {
        "image/png" => ".png",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        _ => ".jpg"
    };

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

    private async Task<string> ReserveNameAsync(string container, string name, CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(name);
        var stem = name[..(name.Length - extension.Length)];
        for (var number = 1; number <= MaxNameTries; number++)
        {
            var candidate = number == 1 ? name : $"{stem} ({number}){extension}";
            if (await _blobs.TryCreateEmptyAsync(container, InputPrefix + candidate, cancellationToken))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException($"No free name for '{name}' after {MaxNameTries} tries.");
    }

    private async Task WriteAsync(string container, string blobName, Stream content, byte[]? key, CancellationToken cancellationToken)
    {
        var metadata = new Dictionary<string, string>();
        if (key != null)
        {
            metadata[EncryptedKey] = "true";
        }

        await using var output = await _blobs.OpenWriteAsync(container, blobName, metadata, cancellationToken);
        if (key == null)
        {
            await content.CopyToAsync(output, cancellationToken);
        }
        else
        {
            await SegmentedCipher.EncryptAsync(key, content, output, cancellationToken);
        }
    }

    private async Task<bool> CopyToAsync(string container, string blobName, byte[]? key, Stream destination, CancellationToken cancellationToken)
    {
        await using var content = await _blobs.OpenReadAsync(container, blobName, cancellationToken);
        if (content == null)
        {
            return false;
        }

        if (!IsEncrypted(content.Metadata))
        {
            await content.Stream.CopyToAsync(destination, cancellationToken);
            return true;
        }

        if (key == null)
        {
            throw new CryptographicException("An encrypted file was read without the owner's key.");
        }

        await SegmentedCipher.DecryptAsync(key, content.Stream, destination, cancellationToken);
        return true;
    }

    private async Task<byte[]?> ReadAsync(string container, string blobName, byte[]? key, CancellationToken cancellationToken)
    {
        var buffer = new MemoryStream();
        return await CopyToAsync(container, blobName, key, buffer, cancellationToken) ? buffer.ToArray() : null;
    }

    private sealed class Manifest
    {
        public int Version { get; set; } = 1;
        public List<ManifestPart> Parts { get; set; } = new();
    }

    private sealed class ManifestPart
    {
        public string Type { get; set; } = string.Empty;
        public string? Text { get; set; }
        public string? Format { get; set; }
        public string? Blob { get; set; }
        public string? MediaType { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
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
