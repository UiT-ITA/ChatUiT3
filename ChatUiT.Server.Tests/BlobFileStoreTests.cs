using System.Security.Cryptography;
using System.Text;
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

    private async Task<string?> ReadOriginalAsync(string name, byte[]? key = null)
    {
        var output = new MemoryStream();
        return await _store.CopyOriginalToAsync(Owner, name, key, output, default) ? Encoding.UTF8.GetString(output.ToArray()) : null;
    }

    private static ConvertedFile Converted() => new(
    [
        new ConvertedText("first", "plain"),
        new ConvertedImage([1, 2, 3], "image/jpeg", 200, 100),
        new ConvertedText("# second", "markdown"),
        new ConvertedImage([4, 5], "image/jpeg", 300, 150)
    ]);

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
        Assert.Equal("a,b", await ReadOriginalAsync("data.csv"));
    }

    [Fact]
    public async Task A_second_file_with_the_same_name_gets_a_suffix()
    {
        await WriteAsync("data.csv", "one");
        var (second, _) = await WriteAsync("data.csv", "two");
        var (third, _) = await WriteAsync("data.csv", "three");

        Assert.Equal("data (2).csv", second);
        Assert.Equal("data (3).csv", third);
        Assert.Equal("one", await ReadOriginalAsync("data.csv"));
        Assert.Equal("two", await ReadOriginalAsync("data (2).csv"));
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
    public async Task Converted_content_is_a_manifest_and_one_blob_per_image()
    {
        await WriteAsync("report.pdf", "pdf");
        await _store.WriteConvertedAsync(Owner, "report.pdf", Converted(), null, default);

        Assert.Equal(
            ["converted/report.pdf/image-1.jpg", "converted/report.pdf/image-2.jpg", "converted/report.pdf/manifest.json", "input/report.pdf"],
            _blobs.Names(Owner));
        Assert.Equal(new byte[] { 1, 2, 3 }, _blobs.Data(Owner, "converted/report.pdf/image-1.jpg"));

        var read = await _store.ReadConvertedAsync(Owner, "report.pdf", null, default);
        Assert.NotNull(read);
        Assert.Equal(4, read.Parts.Count);
        Assert.Equal(new ConvertedText("first", "plain"), read.Parts[0]);
        var image = Assert.IsType<ConvertedImage>(read.Parts[1]);
        Assert.Equal(new byte[] { 1, 2, 3 }, image.Data);
        Assert.Equal((200, 100, "image/jpeg"), (image.Width, image.Height, image.MediaType));
        Assert.Equal(new ConvertedText("# second", "markdown"), read.Parts[2]);
        Assert.Equal(new byte[] { 4, 5 }, Assert.IsType<ConvertedImage>(read.Parts[3]).Data);
    }

    [Fact]
    public async Task Missing_content_reads_as_nothing()
    {
        Assert.Null(await _store.ReadConvertedAsync(Owner, "none.pdf", null, default));
        Assert.Null(await ReadOriginalAsync("none.pdf"));
    }

    [Fact]
    public async Task With_a_key_every_blob_is_encrypted_and_reads_back_with_the_key()
    {
        await WriteAsync("secret.txt", "the secret text", Key);
        await _store.WriteConvertedAsync(Owner, "secret.txt", new ConvertedFile([new ConvertedText("the secret text", "plain"), new ConvertedImage([9, 9, 9, 9], "image/jpeg", 100, 100)]), Key, default);

        foreach (var name in _blobs.Names(Owner))
        {
            Assert.DoesNotContain("secret text", Encoding.UTF8.GetString(_blobs.Data(Owner, name)));
            Assert.Equal("true", _blobs.Containers[Owner][name].Metadata["encrypted"]);
        }
        Assert.NotEqual(new byte[] { 9, 9, 9, 9 }, _blobs.Data(Owner, "converted/secret.txt/image-1.jpg"));

        Assert.Equal("the secret text", await ReadOriginalAsync("secret.txt", Key));
        var read = await _store.ReadConvertedAsync(Owner, "secret.txt", Key, default);
        Assert.Equal(new ConvertedText("the secret text", "plain"), read!.Parts[0]);
        Assert.Equal(new byte[] { 9, 9, 9, 9 }, Assert.IsType<ConvertedImage>(read.Parts[1]).Data);
    }

    [Fact]
    public async Task An_encrypted_file_is_not_readable_without_the_key_or_with_another_key()
    {
        await WriteAsync("secret.txt", "the secret text", Key);

        await Assert.ThrowsAnyAsync<CryptographicException>(() => ReadOriginalAsync("secret.txt"));
        await Assert.ThrowsAnyAsync<CryptographicException>(() => ReadOriginalAsync("secret.txt", RandomNumberGenerator.GetBytes(32)));
    }

    [Fact]
    public async Task Encrypting_a_container_encrypts_the_plain_blobs_and_leaves_the_encrypted_ones()
    {
        await WriteAsync("plain.txt", "plain text");
        await _store.WriteConvertedAsync(Owner, "plain.txt", Converted(), null, default);
        await WriteAsync("already.txt", "already encrypted", Key);
        var alreadyEncrypted = _blobs.Data(Owner, "input/already.txt");

        await _store.EncryptAllAsync(Owner, Key, default);

        Assert.All(_blobs.Names(Owner), name => Assert.Equal("true", _blobs.Containers[Owner][name].Metadata["encrypted"]));
        Assert.DoesNotContain("plain text", Encoding.UTF8.GetString(_blobs.Data(Owner, "input/plain.txt")));
        Assert.Same(alreadyEncrypted, _blobs.Data(Owner, "input/already.txt"));
        Assert.Equal("plain text", await ReadOriginalAsync("plain.txt", Key));
        Assert.Equal("already encrypted", await ReadOriginalAsync("already.txt", Key));
        Assert.Equal(4, (await _store.ReadConvertedAsync(Owner, "plain.txt", Key, default))!.Parts.Count);
    }

    [Fact]
    public async Task Deleting_a_file_removes_its_original_and_converted_content_only()
    {
        await WriteAsync("a.pdf", "a");
        await _store.WriteConvertedAsync(Owner, "a.pdf", Converted(), null, default);
        await WriteAsync("a.pdf.txt", "b");
        await _store.WriteConvertedAsync(Owner, "a.pdf.txt", new ConvertedFile([new ConvertedText("b", "plain")]), null, default);

        await _store.DeleteFileAsync(Owner, "a.pdf", default);

        Assert.Equal(["converted/a.pdf.txt/manifest.json", "input/a.pdf.txt"], _blobs.Names(Owner));
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
