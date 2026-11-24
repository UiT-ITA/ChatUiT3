using System.Security.Cryptography;
using ChatUiT.Server.Services.Encryption;

namespace ChatUiT.Server.Tests;

public class SegmentedCipherTests
{
    private static readonly byte[] Key = RandomNumberGenerator.GetBytes(32);

    private static async Task<byte[]> EncryptAsync(byte[] plaintext, int segmentSize = 16, byte[]? key = null)
    {
        var output = new MemoryStream();
        await SegmentedCipher.EncryptAsync(key ?? Key, new MemoryStream(plaintext), output, default, segmentSize);
        return output.ToArray();
    }

    private static async Task<byte[]> DecryptAsync(byte[] encrypted, byte[]? key = null)
    {
        var output = new MemoryStream();
        await SegmentedCipher.DecryptAsync(key ?? Key, new MemoryStream(encrypted), output);
        return output.ToArray();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(15)]
    [InlineData(16)]
    [InlineData(17)]
    [InlineData(32)]
    [InlineData(1000)]
    public async Task Decrypt_returns_what_was_encrypted(int length)
    {
        var plaintext = RandomNumberGenerator.GetBytes(length);

        var encrypted = await EncryptAsync(plaintext);

        Assert.Equal(plaintext, await DecryptAsync(encrypted));
        Assert.Equal(SegmentedCipher.EncryptedLength(length, 16), encrypted.Length);
    }

    [Fact]
    public async Task Default_segment_size_round_trips_several_segments()
    {
        var plaintext = RandomNumberGenerator.GetBytes(SegmentedCipher.DefaultSegmentSize * 2 + 123);
        var output = new MemoryStream();
        await SegmentedCipher.EncryptAsync(Key, new MemoryStream(plaintext), output);

        Assert.Equal(plaintext, await DecryptAsync(output.ToArray()));
    }

    [Fact]
    public async Task The_same_content_encrypts_differently_each_time()
    {
        var plaintext = RandomNumberGenerator.GetBytes(100);

        Assert.NotEqual(await EncryptAsync(plaintext), await EncryptAsync(plaintext));
    }

    [Fact]
    public async Task The_wrong_key_does_not_decrypt()
    {
        var encrypted = await EncryptAsync(RandomNumberGenerator.GetBytes(100));

        await Assert.ThrowsAnyAsync<CryptographicException>(() => DecryptAsync(encrypted, RandomNumberGenerator.GetBytes(32)));
    }

    [Fact]
    public async Task A_changed_byte_does_not_decrypt()
    {
        var encrypted = await EncryptAsync(RandomNumberGenerator.GetBytes(100));
        encrypted[^20] ^= 1;

        await Assert.ThrowsAnyAsync<CryptographicException>(() => DecryptAsync(encrypted));
    }

    [Fact]
    public async Task Content_cut_off_after_a_whole_segment_does_not_decrypt()
    {
        var encrypted = await EncryptAsync(RandomNumberGenerator.GetBytes(48));
        var withoutLastSegment = encrypted[..^(16 + 16)];

        await Assert.ThrowsAnyAsync<CryptographicException>(() => DecryptAsync(withoutLastSegment));
    }

    [Fact]
    public async Task Swapped_segments_do_not_decrypt()
    {
        var encrypted = await EncryptAsync(RandomNumberGenerator.GetBytes(48));
        var swapped = encrypted.ToArray();
        Array.Copy(encrypted, 16, swapped, 16 + 32, 32);
        Array.Copy(encrypted, 16 + 32, swapped, 16, 32);

        await Assert.ThrowsAnyAsync<CryptographicException>(() => DecryptAsync(swapped));
    }

    [Fact]
    public async Task Content_in_another_format_does_not_decrypt()
    {
        await Assert.ThrowsAnyAsync<CryptographicException>(() => DecryptAsync(RandomNumberGenerator.GetBytes(200)));
    }
}
