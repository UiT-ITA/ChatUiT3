using System.Security.Cryptography;
using System.Text;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Encryption;
using ChatUiT.Server.Services.Files;

namespace ChatUiT.Server.Tests;

public class BlobFileStoreTests
{
    private const string Owner = "0b6f3a52-6d0c-4f0e-9d39-2f6f6c1f7a11";
    private static readonly byte[] Key = RandomNumberGenerator.GetBytes(32);

    private readonly InMemoryBlobStorage _blobs = new();
    private readonly BlobFileStore _store;

    public BlobFileStoreTests()
    {
        _store = new BlobFileStore(_blobs);
    }

    private Task<(string Name, long Size)> WriteAsync(string name, string content, byte[]? key = null, long maxBytes = 1000)
        => _store.WriteOriginalAsync(Owner, name, new MemoryStream(Encoding.UTF8.GetBytes(content)), maxBytes, key, default);

    private string Text(string blob) => Encoding.UTF8.GetString(_blobs.Data(Owner, blob));

    private async Task<byte[]> DecryptAsync(string blob, byte[]? key = null)
    {
        var output = new MemoryStream();
        await SegmentedCipher.DecryptAsync(key ?? Key, new MemoryStream(_blobs.Data(Owner, blob)), output);
        return output.ToArray();
    }

    private static ChatFile File(string name, bool encrypted = false) => new()
    {
        SourceFilename = name,
        IsEncrypted = encrypted,
        Chunks =
        [
            new ChatFileChunk { Type = "text", Text = "first" },
            new ChatFileChunk { Type = "image", MediaType = "image/jpeg", Width = 200, Height = 100, Data = [1, 2, 3] },
            new ChatFileChunk { Type = "text", Text = "# second" },
            new ChatFileChunk { Type = "image", MediaType = "image/jpeg", Width = 300, Height = 150, Data = [4, 5] }
        ]
    };

    /// <summary>The file's chunks without their content, as they are stored in the database.</summary>
    private static ChatFile Unloaded(ChatFile file) => new()
    {
        SourceFilename = file.SourceFilename,
        IsEncrypted = file.IsEncrypted,
        Chunks = file.Chunks.Select(chunk => new ChatFileChunk { Type = chunk.Type, MediaType = chunk.MediaType, Width = chunk.Width, Height = chunk.Height }).ToList()
    };

    [Theory]
    [InlineData("0b6f3a52-6d0c-4f0e-9d39-2f6f6c1f7a11", true)]
    [InlineData("abc", true)]
    [InlineData("ab", false)]
    [InlineData("ABC-def", false)]
    [InlineData("abc--def", false)]
    [InlineData("-abc", false)]
    [InlineData("abc-", false)]
    [InlineData("abc_def", false)]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false)]
    public void Owner_ids_are_checked_as_container_names(string ownerId, bool valid)
    {
        Assert.Equal(valid, BlobFileStore.IsValidOwnerId(ownerId));
    }

    [Fact]
    public async Task An_original_is_stored_in_the_input_folder_of_the_owners_container()
    {
        var (name, size) = await WriteAsync("data.csv", "a,b");

        Assert.Equal("data.csv", name);
        Assert.Equal(3, size);
        Assert.Equal(["input/data.csv"], _blobs.Names(Owner));
        Assert.Equal("a,b", Text("input/data.csv"));
    }

    [Fact]
    public async Task An_original_reads_back_unencrypted_and_encrypted()
    {
        await WriteAsync("plain.txt", "plain text");
        await WriteAsync("secret.txt", "secret text", Key);

        async Task<string?> ReadAsync(ChatFile file, byte[]? key)
        {
            var output = new MemoryStream();
            return await _store.CopyOriginalToAsync(Owner, file, key, output, default) ? Encoding.UTF8.GetString(output.ToArray()) : null;
        }

        Assert.Equal("plain text", await ReadAsync(new ChatFile { SourceFilename = "plain.txt" }, null));
        Assert.Equal("secret text", await ReadAsync(new ChatFile { SourceFilename = "secret.txt", IsEncrypted = true }, Key));
        Assert.Null(await ReadAsync(new ChatFile { SourceFilename = "none.txt" }, null));
        await Assert.ThrowsAnyAsync<CryptographicException>(() => ReadAsync(new ChatFile { SourceFilename = "secret.txt", IsEncrypted = true }, null));
    }

    [Fact]
    public async Task A_second_file_with_the_same_name_gets_a_suffix()
    {
        await WriteAsync("data.csv", "one");
        var (second, _) = await WriteAsync("data.csv", "two");
        var (third, _) = await WriteAsync("data.csv", "three");

        Assert.Equal("data (2).csv", second);
        Assert.Equal("data (3).csv", third);
        Assert.Equal("one", Text("input/data.csv"));
        Assert.Equal("two", Text("input/data (2).csv"));
    }

    [Fact]
    public async Task A_name_taken_by_an_encrypted_file_is_taken_for_an_unencrypted_one_and_the_other_way()
    {
        await WriteAsync("data.csv", "one", Key);
        var (plain, _) = await WriteAsync("data.csv", "two");
        await WriteAsync("notes.txt", "three");
        var (encrypted, _) = await WriteAsync("notes.txt", "four", Key);

        Assert.Equal("data (2).csv", plain);
        Assert.Equal("notes (2).txt", encrypted);
        Assert.Equal(["input/data (2).csv", "input/data.csv.enc", "input/notes (2).txt.enc", "input/notes.txt"], _blobs.Names(Owner));
    }

    [Fact]
    public async Task An_upload_fails_when_no_name_is_free_within_the_limit()
    {
        await _blobs.EnsureContainerAsync(Owner, default);
        await _blobs.TryCreateEmptyAsync(Owner, "input/data.csv", default);
        for (var number = 2; number <= 1000; number++)
        {
            await _blobs.TryCreateEmptyAsync(Owner, $"input/data ({number}).csv", default);
        }

        await Assert.ThrowsAsync<InvalidOperationException>(() => WriteAsync("data.csv", "x"));
        Assert.DoesNotContain("input/data (1001).csv", _blobs.Names(Owner));
    }

    [Fact]
    public async Task Folders_in_the_file_name_are_dropped()
    {
        var (name, _) = await WriteAsync("../other/notes.txt", "x");

        Assert.Equal("notes.txt", name);
    }

    [Fact]
    public async Task A_file_over_the_limit_is_refused_and_not_kept()
    {
        await Assert.ThrowsAsync<FileTooLargeException>(() => WriteAsync("big.txt", "0123456789", maxBytes: 5));

        Assert.Empty(_blobs.Names(Owner));
    }

    [Fact]
    public async Task Converted_content_is_a_manifest_without_metadata_and_one_blob_per_image()
    {
        await WriteAsync("report.pdf", "pdf");
        await _store.WriteConvertedAsync(Owner, File("report.pdf"), null, default);

        Assert.Equal(
            ["converted/report.pdf/image-1.jpg", "converted/report.pdf/image-2.jpg", "converted/report.pdf/manifest.json", "input/report.pdf"],
            _blobs.Names(Owner));
        Assert.Equal("[\"first\",\"image-1.jpg\",\"# second\",\"image-2.jpg\"]", Text("converted/report.pdf/manifest.json"));
        Assert.Equal(new byte[] { 1, 2, 3 }, _blobs.Data(Owner, "converted/report.pdf/image-1.jpg"));
    }

    [Fact]
    public async Task Converted_content_reads_back_into_the_chunks()
    {
        await _blobs.EnsureContainerAsync(Owner, default);
        await _store.WriteConvertedAsync(Owner, File("report.pdf"), null, default);
        var file = Unloaded(File("report.pdf"));

        await _store.ReadConvertedAsync(Owner, file, null, default);

        Assert.True(file.IsContentLoaded);
        Assert.Equal("first", file.Chunks[0].Text);
        Assert.Equal(new byte[] { 1, 2, 3 }, file.Chunks[1].Data);
        Assert.Equal("# second", file.Chunks[2].Text);
        Assert.Equal(new byte[] { 4, 5 }, file.Chunks[3].Data);
    }

    [Fact]
    public async Task Missing_converted_content_reads_as_empty()
    {
        await _blobs.EnsureContainerAsync(Owner, default);
        var file = Unloaded(File("none.pdf"));

        await _store.ReadConvertedAsync(Owner, file, null, default);

        Assert.True(file.IsContentLoaded);
        Assert.Equal("", file.Chunks[0].Text);
        Assert.Empty(file.Chunks[1].Data!);
    }

    [Fact]
    public async Task A_missing_image_reads_as_empty_and_the_rest_reads()
    {
        await _blobs.EnsureContainerAsync(Owner, default);
        await _store.WriteConvertedAsync(Owner, File("report.pdf"), null, default);
        await _blobs.DeleteAsync(Owner, "converted/report.pdf/image-1.jpg", default);
        var file = Unloaded(File("report.pdf"));

        await _store.ReadConvertedAsync(Owner, file, null, default);

        Assert.Equal("first", file.Chunks[0].Text);
        Assert.Empty(file.Chunks[1].Data!);
        Assert.Equal(new byte[] { 4, 5 }, file.Chunks[3].Data);
    }

    [Fact]
    public async Task With_a_key_every_blob_is_encrypted_with_enc_added_and_reads_back_with_the_key()
    {
        await WriteAsync("secret.pdf", "the secret text", Key);
        await _store.WriteConvertedAsync(Owner, File("secret.pdf", encrypted: true), Key, default);

        Assert.Equal(
            ["converted/secret.pdf/image-1.jpg.enc", "converted/secret.pdf/image-2.jpg.enc", "converted/secret.pdf/manifest.json.enc", "input/secret.pdf.enc"],
            _blobs.Names(Owner));
        Assert.DoesNotContain("secret text", Text("input/secret.pdf.enc"));
        Assert.DoesNotContain("first", Text("converted/secret.pdf/manifest.json.enc"));
        Assert.Equal("the secret text", Encoding.UTF8.GetString(await DecryptAsync("input/secret.pdf.enc")));

        var file = Unloaded(File("secret.pdf", encrypted: true));
        await _store.ReadConvertedAsync(Owner, file, Key, default);
        Assert.Equal("first", file.Chunks[0].Text);
        Assert.Equal(new byte[] { 1, 2, 3 }, file.Chunks[1].Data);
    }

    [Fact]
    public async Task An_encrypted_file_is_not_readable_without_the_key_or_with_another_key()
    {
        await _blobs.EnsureContainerAsync(Owner, default);
        await _store.WriteConvertedAsync(Owner, File("secret.pdf", encrypted: true), Key, default);

        await Assert.ThrowsAnyAsync<CryptographicException>(() => _store.ReadConvertedAsync(Owner, Unloaded(File("secret.pdf", encrypted: true)), null, default));
        await Assert.ThrowsAnyAsync<CryptographicException>(() => _store.ReadConvertedAsync(Owner, Unloaded(File("secret.pdf", encrypted: true)), RandomNumberGenerator.GetBytes(32), default));
    }

    [Fact]
    public async Task Encrypting_a_file_writes_encrypted_copies_then_deletes_the_unencrypted_blobs()
    {
        await WriteAsync("plain.pdf", "plain text");
        await _store.WriteConvertedAsync(Owner, File("plain.pdf"), null, default);
        await WriteAsync("other.txt", "other");

        await _store.WriteEncryptedCopiesAsync(Owner, "plain.pdf", Key, default);

        Assert.Contains("input/plain.pdf", _blobs.Names(Owner));
        Assert.Contains("input/plain.pdf.enc", _blobs.Names(Owner));
        Assert.Equal("plain text", Encoding.UTF8.GetString(await DecryptAsync("input/plain.pdf.enc")));

        await _store.DeleteUnencryptedAsync(Owner, "plain.pdf", default);

        Assert.Equal(
            ["converted/plain.pdf/image-1.jpg.enc", "converted/plain.pdf/image-2.jpg.enc", "converted/plain.pdf/manifest.json.enc", "input/other.txt", "input/plain.pdf.enc"],
            _blobs.Names(Owner));
        var file = Unloaded(File("plain.pdf", encrypted: true));
        await _store.ReadConvertedAsync(Owner, file, Key, default);
        Assert.Equal("# second", file.Chunks[2].Text);
    }

    [Fact]
    public async Task The_encrypted_copies_written_are_returned_and_deleting_them_leaves_the_rest()
    {
        await WriteAsync("gone.pdf", "gone");
        await _store.WriteConvertedAsync(Owner, File("gone.pdf"), null, default);
        await WriteAsync("other.txt", "other", Key);

        var copies = await _store.WriteEncryptedCopiesAsync(Owner, "gone.pdf", Key, default);
        await _store.DeleteBlobsAsync(Owner, copies, default);

        Assert.Equal(
            ["converted/gone.pdf/image-1.jpg.enc", "converted/gone.pdf/image-2.jpg.enc", "converted/gone.pdf/manifest.json.enc", "input/gone.pdf.enc"],
            copies.Order(StringComparer.Ordinal));
        Assert.Equal(
            ["converted/gone.pdf/image-1.jpg", "converted/gone.pdf/image-2.jpg", "converted/gone.pdf/manifest.json", "input/gone.pdf", "input/other.txt.enc"],
            _blobs.Names(Owner));
    }

    [Fact]
    public async Task Encrypting_again_after_a_stop_writes_the_copies_again_from_the_unencrypted_blobs()
    {
        await WriteAsync("plain.txt", "plain text");
        await _store.WriteEncryptedCopiesAsync(Owner, "plain.txt", Key, default);
        await _blobs.DeleteAsync(Owner, "input/plain.txt.enc", default);

        await _store.WriteEncryptedCopiesAsync(Owner, "plain.txt", Key, default);

        Assert.Equal("plain text", Encoding.UTF8.GetString(await DecryptAsync("input/plain.txt.enc")));
    }

    [Fact]
    public async Task Deleting_a_file_removes_its_original_and_converted_content_only()
    {
        await WriteAsync("a.pdf", "a");
        await _store.WriteConvertedAsync(Owner, File("a.pdf"), null, default);
        await WriteAsync("a.pdf.txt", "b");
        await _store.WriteConvertedAsync(Owner, new ChatFile { SourceFilename = "a.pdf.txt", Chunks = [new ChatFileChunk { Type = "text", Text = "b" }] }, null, default);

        await _store.DeleteFileAsync(Owner, "a.pdf", default);

        Assert.Equal(["converted/a.pdf.txt/manifest.json", "input/a.pdf.txt"], _blobs.Names(Owner));
    }

    [Fact]
    public async Task Deleting_an_encrypted_file_removes_its_enc_blobs()
    {
        await WriteAsync("a.pdf", "a", Key);
        await _store.WriteConvertedAsync(Owner, File("a.pdf", encrypted: true), Key, default);

        await _store.DeleteFileAsync(Owner, "a.pdf", default);

        Assert.Empty(_blobs.Names(Owner));
    }

    [Fact]
    public async Task Deleting_everything_removes_the_container()
    {
        await WriteAsync("a.txt", "a");

        await _store.DeleteAllAsync(Owner, default);

        Assert.False(_blobs.Containers.ContainsKey(Owner));
    }

    [Fact]
    public async Task An_owner_id_that_cannot_name_a_container_is_refused()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => _store.WriteOriginalAsync("Not_Valid", "a.txt", new MemoryStream(), 10, null, default));
    }
}
