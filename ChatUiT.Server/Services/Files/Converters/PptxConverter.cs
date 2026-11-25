using System.Text.RegularExpressions;
using System.Xml.Linq;
using ChatUiT.Server.Errors;
using DocumentFormat.OpenXml.Packaging;

namespace ChatUiT.Server.Services.Files.Converters;

/// <summary>A presentation as markdown, slide by slide: the text of each shape, tables as markdown tables, and the pictures.</summary>
internal static partial class PptxConverter
{
    public static List<ConvertedPart> Convert(Stream content)
    {
        PresentationDocument document;
        try
        {
            document = PresentationDocument.Open(content, false);
        }
        catch (Exception ex)
        {
            throw new FileConversionException(ErrorCodes.PptxOpenFailed, ex);
        }

        using (document)
        {
            var slides = (document.PresentationPart?.SlideParts ?? [])
                .Where(slide => SlideName().IsMatch(slide.Uri.OriginalString))
                .OrderBy(slide => int.Parse(SlideName().Match(slide.Uri.OriginalString).Groups[1].Value));

            var parts = new List<ConvertedPart>();
            foreach (var slide in slides)
            {
                XElement? shapeTree;
                using (var stream = slide.GetStream())
                {
                    shapeTree = XDocument.Load(stream).Descendants().Named("spTree").FirstOrDefault();
                }

                if (shapeTree != null)
                {
                    AddShapes(shapeTree, slide, parts);
                }
            }

            return parts;
        }
    }

    private static void AddShapes(XElement parent, SlidePart slide, List<ConvertedPart> parts)
    {
        foreach (var child in parent.Elements())
        {
            switch (child.Name.LocalName)
            {
                case "sp" or "graphicFrame":
                    var markdown = ShapeMarkdown(child);
                    if (markdown.Length > 0)
                    {
                        parts.Add(new ConvertedText($"{markdown}\n\n"));
                    }
                    break;
                case "pic":
                    var blip = child.Descendants().Named("blip").FirstOrDefault();
                    if (OpenXmlImages.Read(slide, blip?.AttributeValue("embed")) is { } image)
                    {
                        parts.Add(image);
                    }
                    break;
                case "grpSp":
                    AddShapes(child, slide, parts);
                    break;
            }
        }
    }

    private static string ShapeMarkdown(XElement shape)
    {
        var table = shape.Descendants().Named("tbl").FirstOrDefault();
        if (table != null)
        {
            var rows = table.Descendants().Named("tr")
                .Select(row => (IReadOnlyList<string>)row.Descendants().Named("tc")
                    .Select(cell => ConvertedParts.EscapeTableCell(TextOf(cell)))
                    .ToList())
                .Where(row => row.Count > 0)
                .ToList();
            return ConvertedParts.MarkdownTable(rows);
        }

        var paragraphs = shape.Descendants().Named("p")
            .Select(paragraph =>
            {
                var text = TextOf(paragraph);
                var bullet = paragraph.Descendants().Any(element => element.Name.LocalName is "buChar" or "buAutoNum");
                return text.Length > 0 && bullet ? $"- {text}" : text;
            })
            .Where(text => text.Length > 0);
        return string.Join("\n\n", paragraphs);
    }

    private static string TextOf(XElement element)
        => string.Concat(element.Descendants().Named("t").Select(text => text.Value)).Trim();

    [GeneratedRegex(@"/ppt/slides/slide(\d+)\.xml$")]
    private static partial Regex SlideName();
}
