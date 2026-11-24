using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using ChatUiT.Server.Errors;
using DocumentFormat.OpenXml.Packaging;

namespace ChatUiT.Server.Services.Files.Converters;

/// <summary>
/// A workbook as one markdown table per sheet, with the first row as the header. A picture on a
/// sheet splits its table at the row the picture starts on.
/// </summary>
internal static partial class XlsxConverter
{
    private sealed record SheetRow(int Number, List<string> Cells);

    private sealed record SheetImage(int Row, int Column, string RelationshipId, DrawingsPart Drawings);

    public static List<ConvertedPart> Convert(Stream content)
    {
        SpreadsheetDocument document;
        try
        {
            document = SpreadsheetDocument.Open(content, false);
        }
        catch (Exception ex)
        {
            throw new FileConversionException(ErrorCodes.XlsxOpenFailed, ex);
        }

        using (document)
        {
            var workbookPart = document.WorkbookPart ?? throw new FileConversionException(ErrorCodes.XlsxOpenFailed);
            var workbook = Load(workbookPart);
            var sharedStrings = SharedStrings(workbookPart);
            var dateStyles = DateStyles(workbookPart);
            var date1904 = workbook.Descendants().Named("workbookPr").FirstOrDefault()?.AttributeValue("date1904") is "1" or "true";

            var parts = new List<ConvertedPart>();
            foreach (var sheet in workbook.Descendants().Named("sheet"))
            {
                var relationshipId = sheet.AttributeValue("id");
                if (workbookPart.Parts.FirstOrDefault(pair => pair.RelationshipId == relationshipId).OpenXmlPart is not WorksheetPart worksheetPart)
                {
                    continue;
                }

                var rows = Rows(Load(worksheetPart), sharedStrings, dateStyles, date1904);
                var images = Images(worksheetPart).OrderBy(image => image.Row).ThenBy(image => image.Column).ToList();

                var currentRow = 0;
                foreach (var image in images)
                {
                    AddTable(parts, rows.Where(row => row.Number >= currentRow && row.Number < image.Row));
                    if (OpenXmlImages.Read(image.Drawings, image.RelationshipId) is { } picture)
                    {
                        parts.Add(picture);
                    }

                    currentRow = image.Row;
                }

                AddTable(parts, rows.Where(row => row.Number >= currentRow));
            }

            return parts;
        }
    }

    private static XDocument Load(OpenXmlPart part)
    {
        using var stream = part.GetStream();
        return XDocument.Load(stream);
    }

    private static void AddTable(List<ConvertedPart> parts, IEnumerable<SheetRow> rows)
    {
        var cells = rows.Select(row => row.Cells).ToList();
        if (cells.Count == 0)
        {
            return;
        }

        var width = cells.Max(row => row.Count);
        var padded = cells
            .Select(row => (IReadOnlyList<string>)row.Concat(Enumerable.Repeat(string.Empty, width - row.Count)).Select(ConvertedParts.EscapeTableCell).ToList())
            .ToList();
        parts.Add(new ConvertedText($"{ConvertedParts.MarkdownTable(padded)}\n\n", "markdown"));
    }

    private static List<string> SharedStrings(WorkbookPart workbookPart)
        => workbookPart.SharedStringTablePart is { } part
            ? Load(part).Descendants().Named("si").Select(StringItemText).ToList()
            : [];

    /// <summary>The text of a string item: its runs joined, without phonetic text.</summary>
    private static string StringItemText(XElement item)
        => string.Concat(item.Descendants().Named("t").Where(text => text.Ancestors().All(ancestor => ancestor.Name.LocalName != "rPh")).Select(text => text.Value));

    /// <summary>The indexes of the cell styles that show a number as a date or time.</summary>
    private static HashSet<int> DateStyles(WorkbookPart workbookPart)
    {
        var result = new HashSet<int>();
        if (workbookPart.WorkbookStylesPart is not { } stylesPart)
        {
            return result;
        }

        var styles = Load(stylesPart);
        var customFormats = styles.Descendants().Named("numFmt")
            .Where(format => int.TryParse(format.AttributeValue("numFmtId"), out _))
            .GroupBy(format => int.Parse(format.AttributeValue("numFmtId")!))
            .ToDictionary(group => group.Key, group => group.First().AttributeValue("formatCode") ?? string.Empty);

        var cellFormats = styles.Descendants().Named("cellXfs").FirstOrDefault()?.Elements().Named("xf").ToList() ?? [];
        for (var index = 0; index < cellFormats.Count; index++)
        {
            if (!int.TryParse(cellFormats[index].AttributeValue("numFmtId"), out var formatId))
            {
                continue;
            }

            var isDate = customFormats.TryGetValue(formatId, out var code)
                ? DateFormatLetters().IsMatch(QuotedOrBracketed().Replace(code, string.Empty))
                : formatId is >= 14 and <= 22 or >= 45 and <= 47;
            if (isDate)
            {
                result.Add(index);
            }
        }

        return result;
    }

    private static List<SheetRow> Rows(XDocument worksheet, List<string> sharedStrings, HashSet<int> dateStyles, bool date1904)
    {
        var values = new Dictionary<(int Row, int Column), string>();
        var nextRow = 1;
        foreach (var row in worksheet.Descendants().Named("sheetData").Elements().Named("row"))
        {
            var rowNumber = int.TryParse(row.AttributeValue("r"), out var r) ? r : nextRow;
            nextRow = rowNumber + 1;
            var nextColumn = 1;
            foreach (var cell in row.Elements().Named("c"))
            {
                var column = ColumnOf(cell.AttributeValue("r")) ?? nextColumn;
                nextColumn = column + 1;
                values[(rowNumber, column)] = CellText(cell, sharedStrings, dateStyles, date1904);
            }
        }

        // Every cell of a merged range shows the value of its first cell.
        foreach (var merge in worksheet.Descendants().Named("mergeCell"))
        {
            var range = (merge.AttributeValue("ref") ?? string.Empty).Split(':');
            if (range.Length != 2 || CellOf(range[0]) is not { } from || CellOf(range[1]) is not { } to || !values.TryGetValue(from, out var value))
            {
                continue;
            }

            for (var rowNumber = from.Row; rowNumber <= to.Row; rowNumber++)
            {
                for (var column = from.Column; column <= to.Column; column++)
                {
                    values[(rowNumber, column)] = value;
                }
            }
        }

        var rows = new List<SheetRow>();
        foreach (var group in values.GroupBy(pair => pair.Key.Row).OrderBy(group => group.Key))
        {
            var cells = new List<string>(Enumerable.Repeat(string.Empty, group.Max(pair => pair.Key.Column)));
            foreach (var pair in group)
            {
                cells[pair.Key.Column - 1] = pair.Value.Trim();
            }

            while (cells.Count > 0 && cells[^1].Length == 0)
            {
                cells.RemoveAt(cells.Count - 1);
            }

            if (cells.Count > 0)
            {
                rows.Add(new SheetRow(group.Key, cells));
            }
        }

        return rows;
    }

    private static string CellText(XElement cell, List<string> sharedStrings, HashSet<int> dateStyles, bool date1904)
    {
        var type = cell.AttributeValue("t");
        var value = cell.Elements().Named("v").FirstOrDefault()?.Value;

        if (type == "inlineStr")
        {
            return cell.Elements().Named("is").FirstOrDefault() is { } inline ? StringItemText(inline) : string.Empty;
        }

        if (value == null)
        {
            return string.Empty;
        }

        switch (type)
        {
            case "s":
                return int.TryParse(value, out var index) && index >= 0 && index < sharedStrings.Count ? sharedStrings[index] : string.Empty;
            case "b":
                return value == "1" ? "true" : "false";
            case "e":
                return JsonSerializer.Serialize(new { error = value });
            case "str":
                return value;
        }

        if (!double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
        {
            return value;
        }

        if (int.TryParse(cell.AttributeValue("s"), out var style) && dateStyles.Contains(style))
        {
            var milliseconds = Math.Round((number - 25569 + (date1904 ? 1462 : 0)) * 24 * 3600 * 1000, MidpointRounding.AwayFromZero);
            try
            {
                return DateTime.UnixEpoch.AddMilliseconds(milliseconds).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
            }
            catch (ArgumentOutOfRangeException)
            {
            }
        }

        return number.ToString(CultureInfo.InvariantCulture);
    }

    private static IEnumerable<SheetImage> Images(WorksheetPart worksheetPart)
    {
        if (worksheetPart.DrawingsPart is not { } drawings)
        {
            yield break;
        }

        foreach (var anchor in Load(drawings).Root?.Elements() ?? [])
        {
            var from = anchor.Elements().Named("from").FirstOrDefault();
            var blip = anchor.Elements().Named("pic").Descendants().Named("blip").FirstOrDefault();
            var relationshipId = blip?.AttributeValue("embed");
            if (from == null || string.IsNullOrEmpty(relationshipId))
            {
                continue;
            }

            int.TryParse(from.Elements().Named("row").FirstOrDefault()?.Value, out var row);
            int.TryParse(from.Elements().Named("col").FirstOrDefault()?.Value, out var column);
            yield return new SheetImage(row + 1, column + 1, relationshipId, drawings);
        }
    }

    private static int? ColumnOf(string? reference) => CellOf(reference)?.Column;

    private static (int Row, int Column)? CellOf(string? reference)
    {
        var match = CellReference().Match(reference ?? string.Empty);
        if (!match.Success)
        {
            return null;
        }

        var column = 0;
        foreach (var letter in match.Groups[1].Value)
        {
            column = column * 26 + (letter - 'A' + 1);
        }

        return (int.Parse(match.Groups[2].Value), column);
    }

    [GeneratedRegex(@"^\$?([A-Z]{1,3})\$?(\d{1,7})$")]
    private static partial Regex CellReference();

    [GeneratedRegex("\\[[^\\]]*\\]|\"[^\"]*\"")]
    private static partial Regex QuotedOrBracketed();

    [GeneratedRegex("[ymdhMsb]+")]
    private static partial Regex DateFormatLetters();
}
