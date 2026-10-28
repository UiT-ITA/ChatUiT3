using System;
using System.Collections.Generic;
using System.Linq;
using ChatUiT.Server.Services.Tools;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>
/// Paragraph styles for <see cref="WordDocuments"/>. A style the document lacks is added when it
/// is one of the built-in ones below; ListBullet and ListNumber become list paragraphs.
/// </summary>
internal static class WordStyles
{
    public const string ListBullet = "ListBullet";
    public const string ListNumber = "ListNumber";
    private const string ListParagraph = "ListParagraph";

    private static readonly Dictionary<string, Func<W.Style>> BuiltIn = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Title"] = () => Heading("Title", "Title", 56, outline: null, before: 0),
        ["Heading1"] = () => Heading("Heading1", "heading 1", 32, outline: 0, before: 360),
        ["Heading2"] = () => Heading("Heading2", "heading 2", 28, outline: 1, before: 240),
        ["Heading3"] = () => Heading("Heading3", "heading 3", 24, outline: 2, before: 240),
        [ListParagraph] = () => new W.Style(
            new W.StyleName { Val = "List Paragraph" },
            new W.BasedOn { Val = "Normal" },
            new W.PrimaryStyle(),
            new W.StyleParagraphProperties(new W.Indentation { Left = "720" }, new W.ContextualSpacing()))
        { Type = W.StyleValues.Paragraph, StyleId = ListParagraph }
    };

    /// <summary>The paragraph style ids the document has, then the ones that can be added.</summary>
    public static IEnumerable<string> ParagraphStyleIds(WordprocessingDocument document)
    {
        var existing = Styles(document)?.Elements<W.Style>()
            .Where(s => s.Type?.Value == W.StyleValues.Paragraph && s.StyleId?.Value != null)
            .Select(s => s.StyleId!.Value!) ?? [];
        return existing.Concat(["Title", "Heading1", "Heading2", "Heading3", ListBullet, ListNumber]).Distinct(StringComparer.OrdinalIgnoreCase);
    }

    public static void Apply(WordprocessingDocument document, W.Paragraph paragraph, string style)
    {
        var properties = paragraph.ParagraphProperties ?? paragraph.PrependChild(new W.ParagraphProperties());
        var existing = Find(document, style);

        if (existing == null && (style.Equals(ListBullet, StringComparison.OrdinalIgnoreCase) || style.Equals(ListNumber, StringComparison.OrdinalIgnoreCase)))
        {
            var bullet = style.Equals(ListBullet, StringComparison.OrdinalIgnoreCase);
            properties.ParagraphStyleId = new W.ParagraphStyleId { Val = Ensure(document, ListParagraph) };
            properties.NumberingProperties = new W.NumberingProperties(
                new W.NumberingLevelReference { Val = 0 },
                new W.NumberingId { Val = EnsureNumbering(document, paragraph, bullet) });
            return;
        }

        properties.NumberingProperties = null;
        properties.ParagraphStyleId = new W.ParagraphStyleId { Val = existing ?? Ensure(document, style) };
    }

    public static void AddDefaults(MainDocumentPart main)
    {
        var part = main.AddNewPart<StyleDefinitionsPart>();
        part.Styles = new W.Styles(
            new W.DocDefaults(
                new W.RunPropertiesDefault(new W.RunPropertiesBaseStyle(
                    new W.RunFonts { Ascii = "Aptos", HighAnsi = "Aptos", EastAsia = "Aptos", ComplexScript = "Aptos" },
                    new W.FontSize { Val = "24" },
                    new W.FontSizeComplexScript { Val = "24" })),
                new W.ParagraphPropertiesDefault(new W.ParagraphPropertiesBaseStyle(
                    new W.SpacingBetweenLines { After = "160", Line = "278", LineRule = W.LineSpacingRuleValues.Auto }))),
            new W.Style(new W.StyleName { Val = "Normal" }, new W.PrimaryStyle())
            {
                Type = W.StyleValues.Paragraph,
                StyleId = "Normal",
                Default = true
            });
    }

    private static W.Styles? Styles(WordprocessingDocument document) => document.MainDocumentPart?.StyleDefinitionsPart?.Styles;

    /// <summary>The id of the paragraph style whose id or name is <paramref name="style"/>, ignoring case and spaces.</summary>
    private static string? Find(WordprocessingDocument document, string style)
    {
        static string Key(string? value) => (value ?? string.Empty).Replace(" ", string.Empty);

        return Styles(document)?.Elements<W.Style>()
            .Where(s => s.Type?.Value == W.StyleValues.Paragraph)
            .FirstOrDefault(s => Key(s.StyleId?.Value).Equals(Key(style), StringComparison.OrdinalIgnoreCase)
                || Key(s.StyleName?.Val?.Value).Equals(Key(style), StringComparison.OrdinalIgnoreCase))
            ?.StyleId?.Value;
    }

    private static string Ensure(WordprocessingDocument document, string style)
    {
        if (Find(document, style) is { } id)
        {
            return id;
        }

        if (!BuiltIn.TryGetValue(style, out var create))
        {
            throw new ToolArgumentException($"style \"{style}\" does not exist. Use one of: {string.Join(", ", ParagraphStyleIds(document))}.");
        }

        var main = document.MainDocumentPart!;
        var part = main.StyleDefinitionsPart ?? main.AddNewPart<StyleDefinitionsPart>();
        part.Styles ??= new W.Styles();
        var definition = create();
        part.Styles.Append(definition);
        return definition.StyleId!.Value!;
    }

    private static W.Style Heading(string id, string name, int halfPoints, int? outline, int before)
    {
        var paragraph = new W.StyleParagraphProperties(
            new W.KeepNext(),
            new W.SpacingBetweenLines { Before = before.ToString(), After = "80" });
        if (outline is int level)
        {
            paragraph.Append(new W.OutlineLevel { Val = level });
        }

        return new W.Style(
            new W.StyleName { Val = name },
            new W.BasedOn { Val = "Normal" },
            new W.NextParagraphStyle { Val = "Normal" },
            new W.PrimaryStyle(),
            paragraph,
            new W.StyleRunProperties(
                new W.Bold(),
                new W.FontSize { Val = halfPoints.ToString() },
                new W.FontSizeComplexScript { Val = halfPoints.ToString() }))
        { Type = W.StyleValues.Paragraph, StyleId = id };
    }

    /// <summary>
    /// The numbering instance for <paramref name="paragraph"/>. Bullets share one instance. A numbered
    /// paragraph continues the list of the paragraph just before it, or starts a new list at 1.
    /// </summary>
    private static int EnsureNumbering(WordprocessingDocument document, W.Paragraph paragraph, bool bullet)
    {
        var main = document.MainDocumentPart!;
        var part = main.NumberingDefinitionsPart ?? main.AddNewPart<NumberingDefinitionsPart>();
        part.Numbering ??= new W.Numbering();
        var numbering = part.Numbering;
        var name = bullet ? "ChatUiT bullet" : "ChatUiT number";

        var abstractNum = numbering.Elements<W.AbstractNum>().FirstOrDefault(a => a.AbstractNumDefinitionName?.Val?.Value == name);
        if (abstractNum != null)
        {
            var instances = numbering.Elements<W.NumberingInstance>()
                .Where(n => n.AbstractNumId?.Val?.Value == abstractNum.AbstractNumberId?.Value && n.NumberID?.Value != null)
                .Select(n => n.NumberID!.Value)
                .ToList();
            var previous = (paragraph.PreviousSibling() as W.Paragraph)?.ParagraphProperties?.NumberingProperties?.NumberingId?.Val?.Value;
            if (bullet && instances.Count > 0)
            {
                return instances[0];
            }

            if (!bullet && previous is int listId && instances.Contains(listId))
            {
                return listId;
            }
        }
        else
        {
            var abstractId = numbering.Elements<W.AbstractNum>().Select(a => a.AbstractNumberId?.Value ?? 0).DefaultIfEmpty(-1).Max() + 1;
            abstractNum = new W.AbstractNum(
                new W.MultiLevelType { Val = W.MultiLevelValues.HybridMultilevel },
                new W.AbstractNumDefinitionName { Val = name },
                new W.Level(
                    new W.StartNumberingValue { Val = 1 },
                    new W.NumberingFormat { Val = bullet ? W.NumberFormatValues.Bullet : W.NumberFormatValues.Decimal },
                    new W.LevelText { Val = bullet ? "•" : "%1." },
                    new W.LevelJustification { Val = W.LevelJustificationValues.Left },
                    new W.PreviousParagraphProperties(new W.Indentation { Left = "720", Hanging = "360" }))
                { LevelIndex = 0 })
            { AbstractNumberId = abstractId };

            // Every abstractNum comes before the first num.
            if (numbering.Elements<W.AbstractNum>().LastOrDefault() is { } lastAbstract)
            {
                lastAbstract.InsertAfterSelf(abstractNum);
            }
            else if (numbering.Elements<W.NumberingPictureBullet>().LastOrDefault() is { } lastPicture)
            {
                lastPicture.InsertAfterSelf(abstractNum);
            }
            else
            {
                numbering.PrependChild(abstractNum);
            }
        }

        var numberId = numbering.Elements<W.NumberingInstance>().Select(n => n.NumberID?.Value ?? 0).DefaultIfEmpty(0).Max() + 1;
        var number = new W.NumberingInstance(new W.AbstractNumId { Val = abstractNum.AbstractNumberId!.Value }) { NumberID = numberId };
        if (!bullet)
        {
            number.Append(new W.LevelOverride(new W.StartOverrideNumberingValue { Val = 1 }) { LevelIndex = 0 });
        }

        if (numbering.Elements<W.NumberingInstance>().LastOrDefault() is { } lastNumber)
        {
            lastNumber.InsertAfterSelf(number);
        }
        else
        {
            abstractNum.Parent!.Elements<W.AbstractNum>().Last().InsertAfterSelf(number);
        }

        return numberId;
    }
}
