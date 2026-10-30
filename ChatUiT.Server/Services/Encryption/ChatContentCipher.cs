using System.Security.Cryptography;

namespace ChatUiT.Server.Services.Encryption;

/// <summary>
/// AES-256-GCM over stored chat content. The ciphertext is base64 of nonce, tag and encrypted
/// bytes, in that order.
/// </summary>
public static class ChatContentCipher
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static string Encrypt(byte[] key, ReadOnlySpan<byte> plaintext)
    {
        var output = new byte[NonceSize + TagSize + plaintext.Length];
        var nonce = output.AsSpan(0, NonceSize);
        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plaintext, output.AsSpan(NonceSize + TagSize), output.AsSpan(NonceSize, TagSize));
        return Convert.ToBase64String(output);
    }

    public static byte[] Decrypt(byte[] key, string ciphertext)
    {
        var input = Convert.FromBase64String(ciphertext);
        var plaintext = new byte[input.Length - NonceSize - TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(
            input.AsSpan(0, NonceSize),
            input.AsSpan(NonceSize + TagSize),
            input.AsSpan(NonceSize, TagSize),
            plaintext);
        return plaintext;
    }
}
