using ChatUiT.Server.Errors;
using SkiaSharp;

namespace ChatUiT.Server.Services.Files.Converters;

/// <summary>
/// Turns an image into the JPEG the model gets: at most 2048 px on the long side and 1024 px on
/// the short side, at 85% quality. An image under 100 px on either side is dropped.
/// </summary>
internal static class ImageConverter
{
    public const int MaxLongSide = 2048;
    public const int MaxShortSide = 1024;
    private const int MinSide = 100;
    private const int JpegQuality = 85;

    public static List<ConvertedPart> Convert(Stream content)
        => Normalize(content) is { } image ? [image] : [];

    /// <summary>Null when the image is too small to keep.</summary>
    /// <exception cref="FileConversionException">The content is not a readable image.</exception>
    public static ConvertedImage? Normalize(Stream content)
    {
        using var data = SKData.Create(content);
        using var codec = data == null ? null : SKCodec.Create(data);
        if (codec == null)
        {
            throw new FileConversionException(ErrorCodes.ImageUnreadable);
        }

        using var decoded = SKBitmap.Decode(codec);
        if (decoded == null)
        {
            throw new FileConversionException(ErrorCodes.ImageUnreadable);
        }

        using var upright = Upright(decoded, codec.EncodedOrigin);
        return Normalize(upright);
    }

    public static ConvertedImage? Normalize(SKBitmap bitmap)
    {
        if (bitmap.Width < MinSide || bitmap.Height < MinSide)
        {
            return null;
        }

        var (width, height) = TargetSize(bitmap.Width, bitmap.Height);
        using var surface = SKSurface.Create(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Opaque));
        surface.Canvas.Clear(SKColors.Black);
        using var source = SKImage.FromBitmap(bitmap);
        surface.Canvas.DrawImage(source, new SKRect(0, 0, width, height), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));

        using var snapshot = surface.Snapshot();
        using var jpeg = snapshot.Encode(SKEncodedImageFormat.Jpeg, JpegQuality);
        return new ConvertedImage(jpeg.ToArray(), "image/jpeg", width, height);
    }

    public static (int Width, int Height) TargetSize(int originalWidth, int originalHeight)
    {
        double width = originalWidth;
        double height = originalHeight;

        if (originalWidth > originalHeight)
        {
            if (width > MaxLongSide)
            {
                height *= MaxLongSide / width;
                width = MaxLongSide;
            }

            if (height > MaxShortSide)
            {
                width *= MaxShortSide / height;
                height = MaxShortSide;
            }
        }
        else
        {
            if (height > MaxLongSide)
            {
                width *= MaxLongSide / height;
                height = MaxLongSide;
            }

            if (width > MaxShortSide)
            {
                height *= MaxShortSide / width;
                width = MaxShortSide;
            }
        }

        return ((int)Math.Round(width, MidpointRounding.AwayFromZero), (int)Math.Round(height, MidpointRounding.AwayFromZero));
    }

    /// <summary>The bitmap turned the way its EXIF orientation says it is shown.</summary>
    private static SKBitmap Upright(SKBitmap bitmap, SKEncodedOrigin origin)
    {
        var swapsSides = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var width = swapsSides ? bitmap.Height : bitmap.Width;
        var height = swapsSides ? bitmap.Width : bitmap.Height;

        var result = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul));
        using var canvas = new SKCanvas(result);
        canvas.Clear(SKColors.Transparent);
        float w = bitmap.Width;
        float h = bitmap.Height;
        canvas.SetMatrix(origin switch
        {
            SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
            SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightTop => new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1),
            SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1),
            _ => SKMatrix.Identity
        });
        canvas.DrawBitmap(bitmap, 0, 0, SKSamplingOptions.Default);
        return result;
    }
}
