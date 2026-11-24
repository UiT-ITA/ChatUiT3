using System.Text;
using System.Xml.Linq;

namespace ChatUiT.Server.Services.Files.Converters;

/// <summary>Helpers the converters share.</summary>
internal static class ConvertedParts
{
    /// <summary>Joins neighbouring text parts of the same format and drops empty text.</summary>
    public static List<ConvertedPart> Clean(IEnumerable<ConvertedPart> parts)
    {
        var merged = new List<ConvertedPart>();
        foreach (var part in parts)
        {
            if (part is ConvertedText { Text.Length: 0 })
            {
                continue;
            }

            if (part is ConvertedText text && merged.Count > 0 && merged[^1] is ConvertedText previous && previous.Format == text.Format)
            {
                merged[^1] = previous with { Text = previous.Text + text.Text };
                continue;
            }

            merged.Add(part);
        }

        return merged;
    }

    public static string EscapeTableCell(string value) => value.Replace("|", "\\|").Replace("\n", "<br/>");

    /// <summary>A markdown table with the first row as its header.</summary>
    public static string MarkdownTable(IReadOnlyList<IReadOnlyList<string>> rows)
    {
        if (rows.Count == 0)
        {
            return string.Empty;
        }

        var lines = new List<string>
        {
            $"| {string.Join(" | ", rows[0])} |",
            $"| {string.Join(" | ", rows[0].Select(_ => "---"))} |"
        };
        lines.AddRange(rows.Skip(1).Select(row => $"| {string.Join(" | ", row)} |"));
        return string.Join("\n", lines);
    }

    /// <summary>All text under the element, with a tab for each tab element and a line break for each br element.</summary>
    public static string CollectText(XElement element)
    {
        var text = new StringBuilder();
        Visit(element);
        return text.ToString();

        void Visit(XNode node)
        {
            switch (node)
            {
                case XText value:
                    text.Append(value.Value);
                    break;
                case XElement { Name.LocalName: "tab" }:
                    text.Append('\t');
                    break;
                case XElement { Name.LocalName: "br" }:
                    text.Append('\n');
                    break;
                case XElement child:
                    foreach (var grandchild in child.Nodes())
                    {
                        Visit(grandchild);
                    }
                    break;
            }
        }
    }

    public static IEnumerable<XElement> Named(this IEnumerable<XElement> elements, string localName)
        => elements.Where(element => element.Name.LocalName == localName);

    /// <summary>The value of the attribute with this local name, in any namespace.</summary>
    public static string? AttributeValue(this XElement element, string localName)
        => element.Attributes().FirstOrDefault(attribute => attribute.Name.LocalName == localName)?.Value;
}
