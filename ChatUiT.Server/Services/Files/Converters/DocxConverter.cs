using System.Text.RegularExpressions;
using System.Xml.Linq;
using ChatUiT.Server.Errors;
using DocumentFormat.OpenXml.Packaging;

namespace ChatUiT.Server.Services.Files.Converters;

/// <summary>
/// A Word document as markdown: headings, list items and paragraphs, tables as markdown tables,
/// and the pictures where they stand.
/// </summary>
internal static partial class DocxConverter
{
    public static List<ConvertedPart> Convert(Stream content)
    {
        WordprocessingDocument document;
        try
        {
            document = WordprocessingDocument.Open(content, false);
        }
        catch (Exception ex)
        {
            throw new FileConversionException(ErrorCodes.DocxOpenFailed, ex);
        }

        using (document)
        {
            var mainPart = document.MainDocumentPart;
            XElement? body;
            using (var stream = mainPart?.GetStream())
            {
                body = stream == null ? null : XDocument.Load(stream).Descendants().Named("body").FirstOrDefault();
            }

            if (mainPart == null || body == null)
            {
                throw new FileConversionException(ErrorCodes.DocxContentMissing);
            }

            var parts = new List<ConvertedPart>();
            foreach (var child in body.Elements())
            {
                if (child.Name.LocalName == "p")
                {
                    parts.AddRange(Paragraph(child, mainPart));
                }
                else if (child.Name.LocalName == "tbl")
                {
                    var table = Table(child);
                    if (table.Length > 0)
                    {
                        parts.Add(new ConvertedText($"{table}\n\n", "markdown"));
                    }
                }
            }

            return parts;
        }
    }

    private static List<ConvertedPart> Paragraph(XElement paragraph, MainDocumentPart mainPart)
    {
        var parts = new List<ConvertedPart>();
        var text = new System.Text.StringBuilder();
        var prefix = Prefix(paragraph);
        var prefixUsed = false;

        foreach (var child in paragraph.Elements())
        {
            Visit(child);
        }

        FlushText();
        return parts;

        void FlushText()
        {
            var normalized = NormalizeText(text.ToString());
            text.Clear();
            if (normalized.Length == 0)
            {
                return;
            }

            parts.Add(new ConvertedText($"{(prefixUsed ? string.Empty : prefix)}{normalized}\n\n", "markdown"));
            prefixUsed = true;
        }

        void Visit(XElement element)
        {
            switch (element.Name.LocalName)
            {
                case "t":
                    text.Append(element.Value);
                    return;
                case "tab":
                    text.Append('\t');
                    return;
                case "br":
                    text.Append('\n');
                    return;
                case "drawing":
                    FlushText();
                    foreach (var blip in element.Descendants().Named("blip"))
                    {
                        if (OpenXmlImages.Read(mainPart, blip.AttributeValue("embed")) is { } image)
                        {
                            parts.Add(image);
                        }
                    }
                    return;
            }

            foreach (var child in element.Elements())
            {
                Visit(child);
            }
        }
    }

    private static string Prefix(XElement paragraph)
    {
        var style = paragraph.Descendants().Named("pStyle").FirstOrDefault()?.AttributeValue("val") ?? string.Empty;
        var heading = HeadingStyle().Match(style);
        if (heading.Success)
        {
            return new string('#', int.Parse(heading.Groups[1].Value)) + " ";
        }

        return paragraph.Descendants().Named("numPr").Any() ? "- " : string.Empty;
    }

    private static string NormalizeText(string text)
    {
        text = SpaceBeforeBreak().Replace(text, "\n");
        text = SpaceAfterBreak().Replace(text, "\n");
        return Spaces().Replace(text, " ").Trim();
    }

    private static string Table(XElement table)
    {
        var rows = table.Elements().Named("tr")
            .Select(row => (IReadOnlyList<string>)row.Elements().Named("tc")
                .Select(cell => ConvertedParts.EscapeTableCell(ConvertedParts.CollectText(cell).Trim()))
                .ToList())
            .Where(row => row.Count > 0)
            .ToList();
        return ConvertedParts.MarkdownTable(rows);
    }

    [GeneratedRegex("^Heading([1-6])$", RegexOptions.IgnoreCase)]
    private static partial Regex HeadingStyle();

    [GeneratedRegex(@"\s+\n")]
    private static partial Regex SpaceBeforeBreak();

    [GeneratedRegex(@"\n\s+")]
    private static partial Regex SpaceAfterBreak();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
