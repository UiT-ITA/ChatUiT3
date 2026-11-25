using System.Globalization;
using ChatUiT.Server.Errors;
using SkiaSharp;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Exceptions;
using UglyToad.PdfPig.Graphics;

namespace ChatUiT.Server.Services.Files.Converters;

/// <summary>
/// A PDF as the text of each page, plus a picture of every page that needs one: a page without
/// text, or with a real image or drawing. Images and drawings that repeat on more than half of
/// the pages, such as logos, do not count.
/// </summary>
internal static class PdfConverter
{
    private const int RenderShortSide = 1024;
    private const int RenderMaxLongSide = 2048;
    private const double MinImagePageAreaFraction = 0.05;
    private const int MinRepeatDetectionPages = 3;
    private const int MinContentPathCount = 10;
    private const int MaxSimplePathSegments = 5;
    private const int RectangleSegments = 5;
    private const double SameLineDistance = 4;

    private sealed record PageScan(List<string> Lines, List<(string Key, double AreaFraction)> Images, List<string> PathKeys, double Width, double Height);

    public static List<ConvertedPart> Convert(Stream content, CancellationToken cancellationToken)
    {
        var bytes = ReadAll(content);
        var scans = new List<PageScan>();
        using (var document = Open(bytes))
        {
            foreach (var page in document.GetPages())
            {
                cancellationToken.ThrowIfCancellationRequested();
                scans.Add(Scan(page));
            }
        }

        var repeated = RepeatedKeys(scans);
        var parts = new List<ConvertedPart>();
        for (var index = 0; index < scans.Count; index++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var scan = scans[index];
            var text = string.Join("\n", scan.Lines).Trim();
            if (text.Length > 0)
            {
                parts.Add(new ConvertedText($"{text}\n\n"));
            }

            if (NeedsRender(scan, repeated) && Render(bytes, index, scan) is { } image)
            {
                parts.Add(image);
            }
        }

        return parts;
    }

    private static PdfDocument Open(byte[] bytes)
    {
        try
        {
            return PdfDocument.Open(bytes);
        }
        catch (PdfDocumentEncryptedException ex)
        {
            throw new FileConversionException(ErrorCodes.PdfPasswordProtected, ex);
        }
        catch (Exception ex)
        {
            throw new FileConversionException(ErrorCodes.PdfInvalid, ex);
        }
    }

    private static PageScan Scan(Page page)
    {
        var pageArea = Math.Abs(page.Width * page.Height);
        pageArea = pageArea == 0 ? 1 : pageArea;

        var images = page.GetImages()
            .Select(image => (
                Key: $"image:{RoundedKey(image.BoundingBox.Width, image.BoundingBox.Height, image.BoundingBox.Left, image.BoundingBox.Bottom)}",
                AreaFraction: image.BoundingBox.Width * image.BoundingBox.Height / pageArea))
            .ToList();

        var pathKeys = new List<string>();
        foreach (var path in page.Paths)
        {
            if ((!path.IsFilled && !path.IsStroked) || !IsComplex(path))
            {
                continue;
            }

            var bounds = path.GetBoundingRectangle();
            var box = bounds == null ? string.Empty : RoundedKey(bounds.Value.Left, bounds.Value.Bottom, bounds.Value.Right, bounds.Value.Top);
            pathKeys.Add($"path:{(path.IsFilled ? "f" : string.Empty)}{(path.IsStroked ? "s" : string.Empty)}:{(path.IsFilled ? path.FillColor : null)}:{box}");
        }

        return new PageScan(Lines(page), images, pathKeys, page.Width, page.Height);
    }

    /// <summary>The words of the page as lines: words on the same baseline joined left to right, lines top to bottom.</summary>
    private static List<string> Lines(Page page)
    {
        var lines = page.GetWords()
            .Where(word => word.Letters.Count > 0)
            .GroupBy(word => Math.Round(word.Letters[0].StartBaseLine.Y, MidpointRounding.AwayFromZero))
            .Select(group =>
            {
                var words = group.OrderBy(word => word.BoundingBox.Left).ToList();
                return (X: words[0].BoundingBox.Left, Y: group.Key, Text: string.Join(" ", words.Select(word => word.Text)).Trim());
            })
            .Where(line => line.Text.Length > 0)
            .ToList();

        // Lines closer than SameLineDistance count as one row and read left to right.
        var sorted = new List<(double X, double Y, string Text)>(lines.Count);
        foreach (var line in lines)
        {
            var position = sorted.Count;
            while (position > 0 && ComesBefore(line, sorted[position - 1]))
            {
                position--;
            }

            sorted.Insert(position, line);
        }

        return sorted.Select(line => line.Text).ToList();

        static bool ComesBefore((double X, double Y, string Text) left, (double X, double Y, string Text) right)
            => Math.Abs(left.Y - right.Y) > SameLineDistance ? left.Y > right.Y : left.X < right.X;
    }

    /// <summary>A path with a curve or more than a few straight segments. Rectangles, rules and table borders are not.</summary>
    private static bool IsComplex(PdfPath path)
    {
        var segments = 0;
        foreach (var subpath in path)
        {
            if (subpath.Commands.Any(command => command is PdfSubpath.CubicBezierCurve or PdfSubpath.QuadraticBezierCurve))
            {
                return true;
            }

            segments += subpath.IsDrawnAsRectangle ? RectangleSegments : subpath.Commands.Count;
            if (segments > MaxSimplePathSegments)
            {
                return true;
            }
        }

        return false;
    }

    private static HashSet<string> RepeatedKeys(List<PageScan> scans)
    {
        var repeated = new HashSet<string>();
        if (scans.Count < MinRepeatDetectionPages)
        {
            return repeated;
        }

        var pagesPerKey = new Dictionary<string, int>();
        foreach (var scan in scans)
        {
            foreach (var key in scan.Images.Select(image => image.Key).Concat(scan.PathKeys).Distinct())
            {
                pagesPerKey[key] = pagesPerKey.GetValueOrDefault(key) + 1;
            }
        }

        foreach (var (key, count) in pagesPerKey)
        {
            if (count > scans.Count / 2.0)
            {
                repeated.Add(key);
            }
        }

        return repeated;
    }

    private static bool NeedsRender(PageScan scan, HashSet<string> repeated)
    {
        if (scan.Lines.Count == 0)
        {
            return true;
        }

        if (scan.Images.Any(image => !repeated.Contains(image.Key) && image.AreaFraction >= MinImagePageAreaFraction))
        {
            return true;
        }

        return scan.PathKeys.Count(key => !repeated.Contains(key)) >= MinContentPathCount;
    }

    private static ConvertedImage? Render(byte[] bytes, int pageIndex, PageScan scan)
    {
        var shortSide = Math.Min(scan.Width, scan.Height);
        var longSide = Math.Max(scan.Width, scan.Height);
        if (shortSide <= 0)
        {
            return null;
        }

        var scale = Math.Min(RenderShortSide / shortSide, RenderMaxLongSide / longSide);
        var options = new PDFtoImage.RenderOptions(
            Width: (int)Math.Round(scan.Width * scale, MidpointRounding.AwayFromZero),
            Height: (int)Math.Round(scan.Height * scale, MidpointRounding.AwayFromZero),
            BackgroundColor: SKColors.White);

#pragma warning disable CA1416 // PDFtoImage supports the platforms the server runs on.
        using var bitmap = PDFtoImage.Conversion.ToImage(bytes, (Index)pageIndex, null, options);
#pragma warning restore CA1416
        return ImageConverter.Normalize(bitmap);
    }

    private static string RoundedKey(params double[] values)
        => string.Join(",", values.Select(value => (Math.Round(value * 10, MidpointRounding.AwayFromZero) / 10).ToString(CultureInfo.InvariantCulture)));

    private static byte[] ReadAll(Stream content)
    {
        using var buffer = new MemoryStream();
        content.CopyTo(buffer);
        return buffer.ToArray();
    }
}
