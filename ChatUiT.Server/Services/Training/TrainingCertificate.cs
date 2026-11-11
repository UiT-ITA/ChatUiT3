using System.Globalization;
using System.Reflection;
using ChatUiT.Server.Models;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Writer;

namespace ChatUiT.Server.Services.Training;

/// <summary>
/// Draws the certificate of a stored training result as a one-page landscape A4 PDF: a dark blue
/// band with the UiT seal on the left, and the course, the name and the result on the right.
/// </summary>
public static class TrainingCertificate
{
    private const double BandWidth = 210;
    private const double StripeWidth = 6;
    private const double SealSize = 140;
    private const double SealMargin = 35;
    private const double ContentLeft = 270;
    private const double ContentRightMargin = 60;
    private const double DetailColumnWidth = 175;

    private static readonly Rgb DarkBlue = new(0, 51, 73);
    private static readonly Rgb Blue = new(0, 115, 150);
    private static readonly Rgb LightBlue = new(89, 190, 201);
    private static readonly Rgb White = new(255, 255, 255);
    private static readonly Rgb BodyText = new(60, 60, 60);
    private static readonly Rgb MutedText = new(90, 90, 90);
    private static readonly Rgb Rule = new(200, 205, 208);

    private static readonly TimeZoneInfo NorwegianTime = TimeZoneInfo.FindSystemTimeZoneById("Europe/Oslo");

    private static readonly Lazy<byte[]> RegularFont = new(() => LoadResource("LiberationSans-Regular.ttf"));
    private static readonly Lazy<byte[]> BoldFont = new(() => LoadResource("LiberationSans-Bold.ttf"));
    private static readonly Lazy<byte[]> Seal = new(() => LoadResource("uit-seal-white.png"));

    private readonly record struct Rgb(byte R, byte G, byte B);

    public static byte[] Build(string name, TrainingResult result, TrainingCertificateText text)
    {
        var builder = new PdfDocumentBuilder();
        var page = builder.AddPage(PageSize.A4, isPortrait: false);
        var regular = builder.AddTrueTypeFont(RegularFont.Value);
        var bold = builder.AddTrueTypeFont(BoldFont.Value);

        var width = page.PageSize.Width;
        var height = page.PageSize.Height;
        var contentWidth = width - ContentLeft - ContentRightMargin;

        Fill(page, 0, 0, BandWidth, height, DarkBlue);
        Fill(page, BandWidth, 0, StripeWidth, height, LightBlue);
        var sealLeft = (BandWidth - SealSize) / 2;
        page.AddPng(Seal.Value, new PdfRectangle(sealLeft, height - SealMargin - SealSize, sealLeft + SealSize, height - SealMargin));

        var issuerLines = Wrap(page, text.Issuer, 13, BandWidth - 2 * SealMargin, bold);
        for (var i = 0; i < issuerLines.Count; i++)
        {
            var line = issuerLines[i];
            var y = 45 + (issuerLines.Count - 1 - i) * 17;
            Draw(page, line, 13, (BandWidth - Measure(page, line, 13, bold)) / 2, y, bold, White);
        }

        Draw(page, text.Heading.ToUpper(CultureInfo.InvariantCulture), 13, ContentLeft, height - 95, bold, Blue);
        Draw(page, text.CourseName, Fit(page, text.CourseName, 34, contentWidth, bold), ContentLeft, height - 145, bold, DarkBlue);
        Fill(page, ContentLeft, height - 172, 70, 3, LightBlue);

        Draw(page, text.AwardedTo, 13, ContentLeft, height - 235, regular, MutedText);
        Draw(page, name, Fit(page, name, 32, contentWidth, bold), ContentLeft, height - 280, bold, DarkBlue);
        var statementLines = Wrap(page, text.Statement, 13, contentWidth * 0.75, regular);
        for (var i = 0; i < statementLines.Count; i++)
        {
            Draw(page, statementLines[i], 13, ContentLeft, height - 318 - i * 18, regular, BodyText);
        }

        Fill(page, ContentLeft, 118, contentWidth, 0.6, Rule);
        var completed = TimeZoneInfo.ConvertTime(result.CompletedAt, NorwegianTime).ToString(text.DateFormat, CultureInfo.GetCultureInfo(text.Culture));
        (string Label, string Value)[] details =
        [
            (text.Completed, completed),
            (text.Score, string.Format(CultureInfo.InvariantCulture, text.ScoreFormat, result.Score, result.QuestionCount)),
            (text.Version, result.CourseVersion.ToString(CultureInfo.InvariantCulture))
        ];
        for (var i = 0; i < details.Length; i++)
        {
            var x = ContentLeft + i * DetailColumnWidth;
            Draw(page, details[i].Label.ToUpper(CultureInfo.InvariantCulture), 9, x, 92, bold, Blue);
            Draw(page, details[i].Value, 14, x, 70, regular, DarkBlue);
        }

        return builder.Build();
    }

    private static byte[] LoadResource(string fileName)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"Training.{fileName}")
            ?? throw new InvalidOperationException($"Certificate resource is missing: {fileName}");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }

    private static void Fill(PdfPageBuilder page, double x, double y, double width, double height, Rgb color)
    {
        page.SetTextAndFillColor(color.R, color.G, color.B);
        page.SetStrokeColor(color.R, color.G, color.B);
        page.DrawRectangle(new PdfPoint(x, y), width, height, 0.1, true);
    }

    private static void Draw(PdfPageBuilder page, string text, double size, double x, double y, PdfDocumentBuilder.AddedFont font, Rgb color)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        page.SetTextAndFillColor(color.R, color.G, color.B);
        page.AddText(text, size, new PdfPoint(x, y), font);
    }

    private static double Measure(PdfPageBuilder page, string text, double size, PdfDocumentBuilder.AddedFont font)
    {
        var letters = page.MeasureText(text, size, new PdfPoint(0, 0), font);
        return letters.Count == 0 ? 0 : letters.Max(letter => letter.BoundingBox.Right);
    }

    /// <summary>The largest size up to <paramref name="size"/> at which the text fits the width.</summary>
    private static double Fit(PdfPageBuilder page, string text, double size, double maxWidth, PdfDocumentBuilder.AddedFont font)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return size;
        }

        var measured = Measure(page, text, size, font);
        return measured <= maxWidth ? size : size * maxWidth / measured;
    }

    /// <summary>Breaks the text into lines of at most the width, at spaces.</summary>
    private static List<string> Wrap(PdfPageBuilder page, string text, double size, double maxWidth, PdfDocumentBuilder.AddedFont font)
    {
        var lines = new List<string>();
        var current = string.Empty;
        foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = current.Length == 0 ? word : $"{current} {word}";
            if (current.Length > 0 && Measure(page, candidate, size, font) > maxWidth)
            {
                lines.Add(current);
                current = word;
            }
            else
            {
                current = candidate;
            }
        }

        if (current.Length > 0)
        {
            lines.Add(current);
        }

        return lines;
    }
}
