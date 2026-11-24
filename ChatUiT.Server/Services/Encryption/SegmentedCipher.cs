using System.Buffers.Binary;
using System.Security.Cryptography;

namespace ChatUiT.Server.Services.Encryption;

/// <summary>
/// AES-256-GCM over a stream, one segment at a time. The output is a header (magic, segment
/// size, nonce prefix) followed by the segments, each as encrypted bytes then tag. A segment's
/// nonce is the prefix and its index, and its associated data says whether it is the last one,
/// so segments cannot be reordered, dropped or cut off.
/// </summary>
public static class SegmentedCipher
{
    public const int DefaultSegmentSize = 64 * 1024;

    private static readonly byte[] Magic = "CUS1"u8.ToArray();
    private const int NoncePrefixSize = 8;
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private const int HeaderSize = 4 + 4 + NoncePrefixSize;
    private const int MaxSegmentSize = 16 * 1024 * 1024;

    /// <summary>The encrypted size of <paramref name="plaintextLength"/> bytes.</summary>
    public static long EncryptedLength(long plaintextLength, int segmentSize = DefaultSegmentSize)
    {
        var segments = Math.Max(1, (plaintextLength + segmentSize - 1) / segmentSize);
        return HeaderSize + plaintextLength + segments * TagSize;
    }

    public static async Task EncryptAsync(byte[] key, Stream plaintext, Stream output, CancellationToken cancellationToken = default, int segmentSize = DefaultSegmentSize)
    {
        if (segmentSize is < 1 or > MaxSegmentSize)
        {
            throw new ArgumentOutOfRangeException(nameof(segmentSize));
        }

        var header = new byte[HeaderSize];
        Magic.CopyTo(header, 0);
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), segmentSize);
        RandomNumberGenerator.Fill(header.AsSpan(8, NoncePrefixSize));
        await output.WriteAsync(header, cancellationToken);

        using var aes = new AesGcm(key, TagSize);
        var current = new byte[segmentSize];
        var next = new byte[segmentSize];
        var encrypted = new byte[segmentSize + TagSize];
        var currentLength = await ReadFullAsync(plaintext, current, cancellationToken);

        for (uint index = 0; ; index++)
        {
            // A full segment is the last one only when nothing follows it.
            var nextLength = currentLength == segmentSize ? await ReadFullAsync(plaintext, next, cancellationToken) : 0;
            var isLast = nextLength == 0;

            aes.Encrypt(
                Nonce(header.AsSpan(8, NoncePrefixSize), index),
                current.AsSpan(0, currentLength),
                encrypted.AsSpan(0, currentLength),
                encrypted.AsSpan(currentLength, TagSize),
                AssociatedData(isLast));
            await output.WriteAsync(encrypted.AsMemory(0, currentLength + TagSize), cancellationToken);

            if (isLast)
            {
                return;
            }

            (current, next) = (next, current);
            currentLength = nextLength;
        }
    }

    /// <exception cref="CryptographicException">The input is not this format, is cut off, or does not decrypt with the key.</exception>
    public static async Task DecryptAsync(byte[] key, Stream encrypted, Stream output, CancellationToken cancellationToken = default)
    {
        var header = new byte[HeaderSize];
        if (await ReadFullAsync(encrypted, header, cancellationToken) != HeaderSize || !header.AsSpan(0, 4).SequenceEqual(Magic))
        {
            throw new CryptographicException("The content is not in the segmented format.");
        }

        var segmentSize = BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(4));
        if (segmentSize is < 1 or > MaxSegmentSize)
        {
            throw new CryptographicException("The content has an invalid segment size.");
        }

        using var aes = new AesGcm(key, TagSize);
        var current = new byte[segmentSize + TagSize];
        var next = new byte[segmentSize + TagSize];
        var plaintext = new byte[segmentSize];
        var currentLength = await ReadFullAsync(encrypted, current, cancellationToken);

        for (uint index = 0; ; index++)
        {
            if (currentLength < TagSize)
            {
                throw new CryptographicException("The content is cut off.");
            }

            var nextLength = currentLength == current.Length ? await ReadFullAsync(encrypted, next, cancellationToken) : 0;
            var isLast = nextLength == 0;
            var dataLength = currentLength - TagSize;

            aes.Decrypt(
                Nonce(header.AsSpan(8, NoncePrefixSize), index),
                current.AsSpan(0, dataLength),
                current.AsSpan(dataLength, TagSize),
                plaintext.AsSpan(0, dataLength),
                AssociatedData(isLast));
            await output.WriteAsync(plaintext.AsMemory(0, dataLength), cancellationToken);

            if (isLast)
            {
                return;
            }

            (current, next) = (next, current);
            currentLength = nextLength;
        }
    }

    private static byte[] Nonce(ReadOnlySpan<byte> prefix, uint index)
    {
        var nonce = new byte[NonceSize];
        prefix.CopyTo(nonce);
        BinaryPrimitives.WriteUInt32BigEndian(nonce.AsSpan(NoncePrefixSize), index);
        return nonce;
    }

    private static byte[] AssociatedData(bool isLast) => [isLast ? (byte)1 : (byte)0];

    private static async Task<int> ReadFullAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var total = 0;
        while (total < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(total), cancellationToken);
            if (read == 0)
            {
                break;
            }

            total += read;
        }

        return total;
    }
}
