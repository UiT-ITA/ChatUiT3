using System.Buffers.Binary;

namespace ChatUitReact.Server.Services.TokenCounting;

/// <summary>
/// Reads pixel dimensions from an image's header bytes. The client re-encodes every image
/// to JPEG through a canvas, which strips metadata, so the size marker sits within the first
/// few hundred bytes; PNG and GIF are handled for images that bypass the client.
/// </summary>
public static class ImageHeaderReader
{
    // Enough base64 to cover any canvas-produced JPEG header, and a multiple of 4 so it
    // decodes standalone.
    private const int PrefixCharacters = 65_536;

    public static bool TryReadDimensions(string base64, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (string.IsNullOrWhiteSpace(base64))
        {
            return false;
        }

        var prefixLength = Math.Min(base64.Length, PrefixCharacters);
        prefixLength -= prefixLength % 4;

        if (!TryDecode(base64.AsSpan(0, prefixLength), out var prefix))
        {
            return false;
        }

        var result = TryRead(prefix, out width, out height);
        if (result != ReadResult.NeedMore || prefixLength == base64.Length)
        {
            return result == ReadResult.Found;
        }

        // A JPEG with large leading segments: read the whole thing.
        return TryDecode(base64.AsSpan(), out var full) && TryRead(full, out width, out height) == ReadResult.Found;
    }

    private static bool TryDecode(ReadOnlySpan<char> base64, out byte[] bytes)
    {
        bytes = new byte[base64.Length / 4 * 3];
        if (Convert.TryFromBase64Chars(base64, bytes, out var written))
        {
            if (written != bytes.Length)
            {
                Array.Resize(ref bytes, written);
            }
            return true;
        }

        bytes = Array.Empty<byte>();
        return false;
    }

    private enum ReadResult { Found, Unsupported, NeedMore }

    private static ReadResult TryRead(ReadOnlySpan<byte> bytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (bytes.Length >= 24 &&
            bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
        {
            width = (int)BinaryPrimitives.ReadUInt32BigEndian(bytes[16..20]);
            height = (int)BinaryPrimitives.ReadUInt32BigEndian(bytes[20..24]);
            return width > 0 && height > 0 ? ReadResult.Found : ReadResult.Unsupported;
        }

        if (bytes.Length >= 10 &&
            bytes[0] == (byte)'G' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'8')
        {
            width = BinaryPrimitives.ReadUInt16LittleEndian(bytes[6..8]);
            height = BinaryPrimitives.ReadUInt16LittleEndian(bytes[8..10]);
            return width > 0 && height > 0 ? ReadResult.Found : ReadResult.Unsupported;
        }

        if (bytes.Length >= 4 && bytes[0] == 0xFF && bytes[1] == 0xD8)
        {
            return TryReadJpeg(bytes, out width, out height);
        }

        return ReadResult.Unsupported;
    }

    private static ReadResult TryReadJpeg(ReadOnlySpan<byte> bytes, out int width, out int height)
    {
        width = 0;
        height = 0;

        var offset = 2;
        while (offset < bytes.Length)
        {
            if (bytes[offset] != 0xFF)
            {
                return ReadResult.Unsupported;
            }

            // Fill bytes before a marker.
            while (offset < bytes.Length && bytes[offset] == 0xFF)
            {
                offset++;
            }

            if (offset >= bytes.Length)
            {
                return ReadResult.NeedMore;
            }

            var marker = bytes[offset++];

            // Standalone markers carry no length.
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7))
            {
                continue;
            }

            // End of image or start of scan: no frame header was found.
            if (marker == 0xD9 || marker == 0xDA)
            {
                return ReadResult.Unsupported;
            }

            if (offset + 2 > bytes.Length)
            {
                return ReadResult.NeedMore;
            }

            var length = BinaryPrimitives.ReadUInt16BigEndian(bytes[offset..(offset + 2)]);
            if (length < 2)
            {
                return ReadResult.Unsupported;
            }

            var isStartOfFrame =
                (marker >= 0xC0 && marker <= 0xC3) ||
                (marker >= 0xC5 && marker <= 0xC7) ||
                (marker >= 0xC9 && marker <= 0xCB) ||
                (marker >= 0xCD && marker <= 0xCF);

            if (isStartOfFrame)
            {
                // length(2) precision(1) height(2) width(2)
                if (offset + 7 > bytes.Length)
                {
                    return ReadResult.NeedMore;
                }

                height = BinaryPrimitives.ReadUInt16BigEndian(bytes[(offset + 3)..(offset + 5)]);
                width = BinaryPrimitives.ReadUInt16BigEndian(bytes[(offset + 5)..(offset + 7)]);
                return width > 0 && height > 0 ? ReadResult.Found : ReadResult.Unsupported;
            }

            offset += length;
        }

        return ReadResult.NeedMore;
    }
}
