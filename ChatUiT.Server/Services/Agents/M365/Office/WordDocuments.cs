using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using ChatUiT.Server.Services.Agents.M365.Functions;
using ChatUiT.Server.Services.Tools;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>
/// Reads and edits .docx files. Paragraphs and tables at the top level of the body are
/// numbered from 1 in document order; the numbers in operations refer to the document as it
/// was read, before any of the operations in the same call.
/// </summary>
public static class WordDocuments
{
    public const string MediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    public static string Read(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes, writable: false);
        using var document = WordprocessingDocument.Open(stream, false);
        var body = BodyOf(document);
        var outline = Outline.Of(body);

        var text = new StringBuilder();
        text.AppendLine("Word document. Paragraphs are [pN], tables [tN] with rows rN; cells are separated by \" | \". \\n is a line break. Use these numbers with edit_word_document.");
        text.AppendLine($"Paragraph styles: {string.Join(", ", WordStyles.ParagraphStyleIds(document))}");
        text.AppendLine();

        foreach (var block in outline.Blocks)
        {
            if (block is W.Paragraph paragraph)
            {
                var label = Label(paragraph);
                text.AppendLine($"[p{outline.Paragraphs.IndexOf(paragraph) + 1}]{(label.Length > 0 ? $" ({label})" : string.Empty)} {Escape(Display(paragraph))}");
            }
            else if (block is W.Table table)
            {
                var rows = table.Elements<W.TableRow>().ToList();
                text.AppendLine($"[t{outline.Tables.IndexOf(table) + 1}] table, {rows.Count} rows");
                for (var r = 0; r < rows.Count; r++)
                {
                    text.AppendLine($"  r{r + 1}: {string.Join(" | ", rows[r].Elements<W.TableCell>().Select(CellText))}");
                }
            }
        }

        return text.ToString();
    }

    /// <summary>Applies <paramref name="operations"/> in order and returns the new file and one summary line per operation.</summary>
    public static (byte[] Bytes, List<string> Changes) Apply(byte[] bytes, IReadOnlyList<WordOperation> operations, string author)
    {
        using var stream = new MemoryStream();
        stream.Write(bytes);
        stream.Position = 0;

        List<string> changes;
        using (var document = WordprocessingDocument.Open(stream, true))
        {
            changes = new Editor(document, author).Apply(operations);
        }

        return (stream.ToArray(), changes);
    }

    /// <summary>A new A4 document with <paramref name="paragraphs"/>, or one empty paragraph.</summary>
    public static byte[] Create(IReadOnlyList<NewParagraph>? paragraphs)
    {
        using var stream = new MemoryStream();
        using (var document = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document))
        {
            var main = document.AddMainDocumentPart();
            var body = new W.Body();
            main.Document = new W.Document(body);
            WordStyles.AddDefaults(main);

            foreach (var (item, index) in (paragraphs ?? []).Select((p, i) => (p, i)))
            {
                var paragraph = new W.Paragraph();
                if (!string.IsNullOrEmpty(item.Text))
                {
                    paragraph.Append(Editor.NewRun(null, item.Text));
                }

                body.Append(paragraph);
                if (!string.IsNullOrWhiteSpace(item.Style))
                {
                    try
                    {
                        WordStyles.Apply(document, paragraph, item.Style);
                    }
                    catch (ToolArgumentException ex)
                    {
                        throw new ToolArgumentException($"Paragraph {index + 1}: {ex.Message}");
                    }
                }
            }

            if (!body.Elements<W.Paragraph>().Any())
            {
                body.Append(new W.Paragraph());
            }

            body.Append(new W.SectionProperties(
                new W.PageSize { Width = 11906, Height = 16838 },
                new W.PageMargin { Top = 1417, Right = 1417, Bottom = 1417, Left = 1417, Header = 708, Footer = 708, Gutter = 0 }));
        }

        return stream.ToArray();
    }

    internal static W.Body BodyOf(WordprocessingDocument document)
        => document.MainDocumentPart?.Document?.Body ?? throw new ToolArgumentException("The document has no body.");

    /// <summary>The text elements, tabs and breaks of the runs that belong to <paramref name="paragraph"/> itself, not to nested text boxes.</summary>
    internal static List<OpenXmlElement> Atoms(W.Paragraph paragraph) => paragraph.Descendants<W.Run>()
        .Where(run => run.Ancestors<W.Paragraph>().FirstOrDefault() == paragraph)
        .SelectMany(run => run.ChildElements.Where(child => child is W.Text or W.TabChar or W.Break))
        .ToList();

    internal static string Display(W.Paragraph paragraph) => RunText.Join(Atoms(paragraph));

    private static string Escape(string text) => text.Replace("\n", "\\n");

    private static string CellText(W.TableCell cell) => string.Join("\\n", cell.Elements<W.Paragraph>().Select(p => Escape(Display(p))));

    private static string Label(W.Paragraph paragraph)
    {
        var parts = new List<string>();
        if (paragraph.ParagraphProperties?.ParagraphStyleId?.Val?.Value is { } style)
        {
            parts.Add(style);
        }

        if (paragraph.ParagraphProperties?.NumberingProperties != null)
        {
            parts.Add("list");
        }

        return string.Join(", ", parts);
    }

    /// <summary>The top-level paragraphs and tables of the body in order, looking inside block content controls.</summary>
    internal sealed class Outline
    {
        public List<OpenXmlElement> Blocks { get; } = [];

        public List<W.Paragraph> Paragraphs { get; } = [];

        public List<W.Table> Tables { get; } = [];

        public static Outline Of(W.Body body)
        {
            var outline = new Outline();
            outline.Walk(body);
            return outline;
        }

        private void Walk(OpenXmlElement parent)
        {
            foreach (var child in parent.ChildElements)
            {
                switch (child)
                {
                    case W.Paragraph paragraph:
                        Blocks.Add(paragraph);
                        Paragraphs.Add(paragraph);
                        break;
                    case W.Table table:
                        Blocks.Add(table);
                        Tables.Add(table);
                        break;
                    case W.SdtBlock { SdtContentBlock: { } content }:
                        Walk(content);
                        break;
                }
            }
        }
    }

    private sealed class Editor
    {
        private readonly WordprocessingDocument _document;
        private readonly string _author;
        private readonly W.Body _body;
        private readonly Outline _outline;
        private readonly List<List<W.TableRow>> _rows;

        // Where the last element inserted after an anchor went, so several inserts after the same anchor keep their order.
        private readonly Dictionary<OpenXmlElement, OpenXmlElement> _lastAfter = new();

        public Editor(WordprocessingDocument document, string author)
        {
            _document = document;
            _author = author;
            _body = BodyOf(document);
            _outline = Outline.Of(_body);
            _rows = _outline.Tables.Select(t => t.Elements<W.TableRow>().ToList()).ToList();
        }

        public List<string> Apply(IReadOnlyList<WordOperation> operations)
        {
            if (operations.Count == 0)
            {
                throw new ToolArgumentException("operations must not be empty.");
            }

            var changes = new List<string>();
            for (var i = 0; i < operations.Count; i++)
            {
                try
                {
                    changes.Add(ApplyOne(operations[i]));
                }
                catch (ToolArgumentException ex)
                {
                    throw new ToolArgumentException($"Operation {i + 1} ({operations[i].Type}): {ex.Message}");
                }
            }

            // Word needs a paragraph after a table that ends the document.
            var last = _body.ChildElements.LastOrDefault(e => e is not W.SectionProperties);
            if (last is not W.Paragraph)
            {
                Insert(null, WordInsertPosition.After, new W.Paragraph());
            }

            return changes;
        }

        private string ApplyOne(WordOperation op) => op.Type switch
        {
            WordOperationType.ReplaceText => ReplaceText(op),
            WordOperationType.SetParagraphText => SetParagraphText(op),
            WordOperationType.InsertParagraph => InsertParagraph(op),
            WordOperationType.DeleteParagraph => DeleteParagraph(op),
            WordOperationType.FormatText => FormatText(op),
            WordOperationType.AddComment => AddComment(op),
            WordOperationType.InsertTable => InsertTable(op),
            WordOperationType.SetTableCell => SetTableCell(op),
            WordOperationType.InsertTableRows => InsertTableRows(op),
            WordOperationType.DeleteTableRow => DeleteTableRow(op),
            _ => throw new ToolArgumentException("unknown operation type.")
        };

        private string ReplaceText(WordOperation op)
        {
            var find = OfficeFiles.Required(op.Find, "find");
            var replace = op.Replace ?? throw new ToolArgumentException("replace is required (use an empty string to delete).");
            var targets = op.Paragraph != null ? [Paragraph(op.Paragraph)] : _body.Descendants<W.Paragraph>().ToList();

            var count = targets.Sum(p => RunText.ReplaceAll(() => Atoms(p), find, replace, InsertText));
            foreach (var paragraph in targets)
            {
                ExpandBreaks(paragraph);
            }

            if (count == 0)
            {
                throw new ToolArgumentException($"\"{RunText.Short(find)}\" was not found{(op.Paragraph != null ? $" in paragraph {op.Paragraph}" : string.Empty)}.");
            }

            return $"Replace \"{RunText.Short(find)}\" with \"{RunText.Short(replace)}\"{(op.Paragraph != null ? $" in paragraph {op.Paragraph}" : string.Empty)} ({count}×)";
        }

        private string SetParagraphText(WordOperation op)
        {
            var paragraph = Paragraph(op.Paragraph);
            var text = op.Text ?? throw new ToolArgumentException("text is required.");
            var before = Display(paragraph);

            SetText(paragraph, text);
            if (!string.IsNullOrWhiteSpace(op.Style))
            {
                WordStyles.Apply(_document, paragraph, op.Style);
            }

            return $"Set paragraph {op.Paragraph}{StyleNote(op.Style)}\n   Before: {RunText.Short(before, 300)}\n   After: {RunText.Short(text, 300)}";
        }

        private string InsertParagraph(WordOperation op)
        {
            var anchor = Anchor(op);
            var paragraph = new W.Paragraph();
            if (!string.IsNullOrEmpty(op.Text))
            {
                paragraph.Append(NewRun(null, op.Text));
            }

            Insert(anchor, op.Position ?? WordInsertPosition.After, paragraph);
            if (!string.IsNullOrWhiteSpace(op.Style))
            {
                WordStyles.Apply(_document, paragraph, op.Style);
            }

            return $"Insert paragraph {Where(op)}{StyleNote(op.Style)}: {RunText.Short(op.Text ?? string.Empty, 300)}";
        }

        private string DeleteParagraph(WordOperation op)
        {
            var paragraph = Paragraph(op.Paragraph);
            var text = Display(paragraph);
            paragraph.Remove();
            return $"Delete paragraph {op.Paragraph}: {RunText.Short(text, 300)}";
        }

        private string FormatText(WordOperation op)
        {
            if (op.Bold == null && op.Italic == null && op.Underline == null)
            {
                throw new ToolArgumentException("set at least one of bold, italic and underline.");
            }

            var paragraph = Paragraph(op.Paragraph);
            var runs = new List<W.Run>();
            if (string.IsNullOrEmpty(op.Find))
            {
                runs.AddRange(Atoms(paragraph).Select(a => (W.Run)a.Parent!).Distinct());
            }
            else
            {
                var starts = RunText.Matches(Display(paragraph), op.Find);
                if (starts.Count == 0)
                {
                    throw new ToolArgumentException($"\"{RunText.Short(op.Find)}\" was not found in paragraph {op.Paragraph}.");
                }

                foreach (var start in starts)
                {
                    runs.AddRange(Isolate(paragraph, start, start + op.Find.Length));
                }
            }

            foreach (var run in runs)
            {
                var properties = run.RunProperties ?? run.PrependChild(new W.RunProperties());
                if (op.Bold is bool bold)
                {
                    properties.Bold = new W.Bold { Val = OnOffValue.FromBoolean(bold) };
                }

                if (op.Italic is bool italic)
                {
                    properties.Italic = new W.Italic { Val = OnOffValue.FromBoolean(italic) };
                }

                if (op.Underline is bool underline)
                {
                    properties.Underline = new W.Underline { Val = underline ? W.UnderlineValues.Single : W.UnderlineValues.None };
                }
            }

            var formats = new[] { ("bold", op.Bold), ("italic", op.Italic), ("underline", op.Underline) }
                .Where(f => f.Item2 != null)
                .Select(f => f.Item2 == true ? f.Item1 : $"not {f.Item1}");
            var target = string.IsNullOrEmpty(op.Find) ? $"paragraph {op.Paragraph}" : $"\"{RunText.Short(op.Find)}\" in paragraph {op.Paragraph}";
            return $"Make {target} {string.Join(", ", formats)}";
        }

        private string AddComment(WordOperation op)
        {
            var paragraph = Paragraph(op.Paragraph);
            var text = OfficeFiles.Required(op.Text, "text");

            List<W.Run> runs;
            if (string.IsNullOrEmpty(op.Find))
            {
                runs = Atoms(paragraph).Select(a => (W.Run)a.Parent!).Distinct().ToList();
            }
            else
            {
                var start = RunText.Matches(Display(paragraph), op.Find).DefaultIfEmpty(-1).First();
                if (start < 0)
                {
                    throw new ToolArgumentException($"\"{RunText.Short(op.Find)}\" was not found in paragraph {op.Paragraph}.");
                }

                runs = Isolate(paragraph, start, start + op.Find.Length);
            }

            var main = _document.MainDocumentPart!;
            var part = main.WordprocessingCommentsPart ?? main.AddNewPart<WordprocessingCommentsPart>();
            part.Comments ??= new W.Comments();
            var id = (part.Comments.Elements<W.Comment>().Select(c => int.TryParse(c.Id?.Value, out var v) ? v : 0).DefaultIfEmpty(0).Max() + 1).ToString();
            part.Comments.Append(new W.Comment(new W.Paragraph(NewRun(null, text)))
            {
                Id = id,
                Author = _author,
                Initials = Initials(_author),
                Date = DateTime.UtcNow
            });

            var reference = new W.Run(new W.CommentReference { Id = id });
            if (runs.Count == 0)
            {
                paragraph.Append(new W.CommentRangeStart { Id = id }, new W.CommentRangeEnd { Id = id }, reference);
            }
            else
            {
                runs[0].InsertBeforeSelf(new W.CommentRangeStart { Id = id });
                runs[^1].InsertAfterSelf(new W.CommentRangeEnd { Id = id }).InsertAfterSelf(reference);
            }

            var target = string.IsNullOrEmpty(op.Find) ? $"paragraph {op.Paragraph}" : $"\"{RunText.Short(op.Find)}\" in paragraph {op.Paragraph}";
            return $"Comment on {target}: {RunText.Short(text, 300)}";
        }

        private string InsertTable(WordOperation op)
        {
            var rows = op.Rows is { Count: > 0 } r ? r : throw new ToolArgumentException("rows is required.");
            var columns = rows.Max(row => row.Count);
            if (columns == 0)
            {
                throw new ToolArgumentException("rows must have at least one cell.");
            }

            var table = new W.Table(
                new W.TableProperties(
                    new W.TableWidth { Width = "5000", Type = W.TableWidthUnitValues.Pct },
                    new W.TableBorders(
                        new W.TopBorder { Val = W.BorderValues.Single, Size = 4 },
                        new W.LeftBorder { Val = W.BorderValues.Single, Size = 4 },
                        new W.BottomBorder { Val = W.BorderValues.Single, Size = 4 },
                        new W.RightBorder { Val = W.BorderValues.Single, Size = 4 },
                        new W.InsideHorizontalBorder { Val = W.BorderValues.Single, Size = 4 },
                        new W.InsideVerticalBorder { Val = W.BorderValues.Single, Size = 4 })),
                new W.TableGrid(Enumerable.Range(0, columns).Select(_ => new W.GridColumn { Width = (9000 / columns).ToString() })));

            foreach (var row in rows)
            {
                table.Append(new W.TableRow(Enumerable.Range(0, columns).Select(c => NewCell(c < row.Count ? row[c] : string.Empty))));
            }

            Insert(Anchor(op), op.Position ?? WordInsertPosition.After, table);
            return $"Insert table {Where(op)}, {rows.Count} rows × {columns} columns\n   First row: {RunText.Short(string.Join(" | ", rows[0]), 300)}";
        }

        private string SetTableCell(WordOperation op)
        {
            var row = Row(op.Table, op.Row);
            var text = op.Text ?? throw new ToolArgumentException("text is required.");
            var column = op.Column ?? throw new ToolArgumentException("column is required.");
            var cells = row.Elements<W.TableCell>().ToList();
            if (column < 1 || column > cells.Count)
            {
                throw new ToolArgumentException($"column must be between 1 and {cells.Count}.");
            }

            var before = CellText(cells[column - 1]);
            SetCellText(cells[column - 1], text);
            return $"Set table {op.Table} row {op.Row} column {column}\n   Before: {RunText.Short(before, 300)}\n   After: {RunText.Short(text, 300)}";
        }

        private string InsertTableRows(WordOperation op)
        {
            var table = Table(op.Table);
            var rows = op.Rows is { Count: > 0 } r ? r : throw new ToolArgumentException("rows is required.");
            var anchor = op.Row != null ? Row(op.Table, op.Row) : table.Elements<W.TableRow>().LastOrDefault()
                ?? throw new ToolArgumentException("the table has no rows.");

            var previous = (OpenXmlElement)(_lastAfter.TryGetValue(anchor, out var last) ? last : anchor);
            foreach (var values in rows)
            {
                var row = (W.TableRow)anchor.CloneNode(true);
                row.TableRowProperties?.RemoveAllChildren<W.TableHeader>();
                var cells = row.Elements<W.TableCell>().ToList();
                if (values.Count > cells.Count)
                {
                    throw new ToolArgumentException($"a row has {values.Count} values but the table has {cells.Count} columns.");
                }

                for (var c = 0; c < cells.Count; c++)
                {
                    SetCellText(cells[c], c < values.Count ? values[c] : string.Empty);
                }

                previous = previous.InsertAfterSelf(row);
            }

            _lastAfter[anchor] = previous;
            return $"Insert {rows.Count} row(s) in table {op.Table} {(op.Row != null ? $"after row {op.Row}" : "at the end")}\n   First row: {RunText.Short(string.Join(" | ", rows[0]), 300)}";
        }

        private string DeleteTableRow(WordOperation op)
        {
            var table = Table(op.Table);
            var row = Row(op.Table, op.Row);
            var text = string.Join(" | ", row.Elements<W.TableCell>().Select(CellText));
            row.Remove();
            if (!table.Elements<W.TableRow>().Any())
            {
                table.Remove();
            }

            return $"Delete table {op.Table} row {op.Row}: {RunText.Short(text, 300)}";
        }

        private W.Paragraph Paragraph(int? number)
        {
            var count = _outline.Paragraphs.Count;
            if (number is not int n || n < 1 || n > count)
            {
                throw new ToolArgumentException($"paragraph must be between 1 and {count}.");
            }

            return Alive(_outline.Paragraphs[n - 1], $"paragraph {n}");
        }

        private W.Table Table(int? number)
        {
            var count = _outline.Tables.Count;
            if (number is not int n || n < 1 || n > count)
            {
                throw new ToolArgumentException(count == 0 ? "the document has no tables." : $"table must be between 1 and {count}.");
            }

            return Alive(_outline.Tables[n - 1], $"table {n}");
        }

        private W.TableRow Row(int? table, int? number)
        {
            Table(table);
            var rows = _rows[table!.Value - 1];
            if (number is not int n || n < 1 || n > rows.Count)
            {
                throw new ToolArgumentException($"row must be between 1 and {rows.Count}.");
            }

            return Alive(rows[n - 1], $"row {n}");
        }

        private static T Alive<T>(T element, string name) where T : OpenXmlElement
            => element.Parent != null ? element : throw new ToolArgumentException($"{name} was deleted by an earlier operation.");

        private OpenXmlElement? Anchor(WordOperation op)
            => op.Table != null ? Table(op.Table) : op.Paragraph != null ? Paragraph(op.Paragraph) : null;

        private static string Where(WordOperation op)
        {
            var position = op.Position == WordInsertPosition.Before ? "before" : "after";
            return op.Table != null ? $"{position} table {op.Table}" : op.Paragraph != null ? $"{position} paragraph {op.Paragraph}" : "at the end";
        }

        private static string StyleNote(string? style) => string.IsNullOrWhiteSpace(style) ? string.Empty : $" as {style}";

        /// <summary>Inserts <paramref name="element"/> next to <paramref name="anchor"/>, or at the end of the body when there is none.</summary>
        private void Insert(OpenXmlElement? anchor, WordInsertPosition position, OpenXmlElement element)
        {
            if (anchor == null)
            {
                if (_body.GetFirstChild<W.SectionProperties>() is { } section)
                {
                    section.InsertBeforeSelf(element);
                }
                else
                {
                    _body.Append(element);
                }

                return;
            }

            if (position == WordInsertPosition.Before)
            {
                anchor.InsertBeforeSelf(element);
                return;
            }

            var after = _lastAfter.TryGetValue(anchor, out var last) && last.Parent != null ? last : anchor;
            after.InsertAfterSelf(element);
            _lastAfter[anchor] = element;
        }

        /// <summary>
        /// Replaces the paragraph's content with <paramref name="text"/> in the formatting of its first run.
        /// Bookmark and comment anchors stay, with the new text before the first anchor that ends.
        /// </summary>
        private static void SetText(W.Paragraph paragraph, string text)
        {
            var properties = Atoms(paragraph).Select(a => ((W.Run)a.Parent!).RunProperties).FirstOrDefault();
            var clone = (W.RunProperties?)properties?.CloneNode(true);
            foreach (var child in paragraph.ChildElements.Where(c => c is not W.ParagraphProperties && !IsAnchor(c)).ToList())
            {
                child.Remove();
            }

            if (text.Length > 0)
            {
                var run = NewRun(clone, text);
                if (paragraph.ChildElements.FirstOrDefault(c => c is W.BookmarkEnd or W.CommentRangeEnd or W.Run) is { } end)
                {
                    end.InsertBeforeSelf(run);
                }
                else
                {
                    paragraph.Append(run);
                }
            }
        }

        private static bool IsAnchor(OpenXmlElement element)
            => element is W.BookmarkStart or W.BookmarkEnd or W.CommentRangeStart or W.CommentRangeEnd
                || (element is W.Run run && run.ChildElements.All(c => c is W.RunProperties or W.CommentReference) && run.GetFirstChild<W.CommentReference>() != null);

        private static void SetCellText(W.TableCell cell, string text)
        {
            var paragraphs = cell.Elements<W.Paragraph>().ToList();
            var first = paragraphs.FirstOrDefault() ?? cell.AppendChild(new W.Paragraph());
            foreach (var extra in paragraphs.Skip(1))
            {
                extra.Remove();
            }

            SetText(first, text);
        }

        private static W.TableCell NewCell(string text)
        {
            var paragraph = new W.Paragraph();
            if (text.Length > 0)
            {
                paragraph.Append(NewRun(null, text));
            }

            return new W.TableCell(paragraph);
        }

        /// <summary>A run with <paramref name="text"/>, where \n becomes a line break and \t a tab.</summary>
        public static W.Run NewRun(W.RunProperties? properties, string text)
        {
            var run = new W.Run();
            if (properties != null)
            {
                run.Append(properties);
            }

            run.Append(Pieces(text));
            return run;
        }

        /// <summary>Text elements for <paramref name="text"/>, with a break for each \n and a tab for each \t.</summary>
        private static List<OpenXmlElement> Pieces(string text)
        {
            var pieces = new List<OpenXmlElement>();
            var segment = new StringBuilder();
            void Flush()
            {
                if (segment.Length > 0)
                {
                    pieces.Add(new W.Text(segment.ToString()) { Space = SpaceProcessingModeValues.Preserve });
                    segment.Clear();
                }
            }

            foreach (var c in text.Replace("\r\n", "\n"))
            {
                if (c is '\n' or '\t')
                {
                    Flush();
                    pieces.Add(c == '\n' ? new W.Break() : new W.TabChar());
                }
                else
                {
                    segment.Append(c);
                }
            }

            Flush();
            return pieces;
        }

        /// <summary>Turns each \n and \t inside the paragraph's text elements into a break or a tab.</summary>
        private static void ExpandBreaks(W.Paragraph paragraph)
        {
            foreach (var text in Atoms(paragraph).OfType<W.Text>().Where(t => t.Text.IndexOfAny(['\n', '\t']) >= 0).ToList())
            {
                foreach (var piece in Pieces(text.Text))
                {
                    text.InsertBeforeSelf(piece);
                }

                text.Remove();
            }
        }

        private static void InsertText(OpenXmlElement atom, string text)
            => atom.InsertBeforeSelf(new W.Text(text) { Space = SpaceProcessingModeValues.Preserve });

        /// <summary>Splits runs so the characters from <paramref name="start"/> to <paramref name="end"/> are whole runs, and returns them.</summary>
        private static List<W.Run> Isolate(W.Paragraph paragraph, int start, int end)
        {
            SplitAt(paragraph, end);
            SplitAt(paragraph, start);

            var runs = new List<W.Run>();
            var offset = 0;
            foreach (var atom in Atoms(paragraph))
            {
                var length = RunText.Of(atom).Length;
                if (length > 0 && offset >= start && offset + length <= end && atom.Parent is W.Run run && !runs.Contains(run))
                {
                    runs.Add(run);
                }

                offset += length;
            }

            return runs;
        }

        private static void SplitAt(W.Paragraph paragraph, int position)
        {
            var offset = 0;
            foreach (var atom in Atoms(paragraph))
            {
                var length = RunText.Of(atom).Length;
                if (position == offset)
                {
                    SplitRunBefore(atom);
                    return;
                }

                if (position > offset && position < offset + length && atom is W.Text text)
                {
                    var cut = position - offset;
                    var tail = new W.Text(text.Text[cut..]) { Space = SpaceProcessingModeValues.Preserve };
                    text.Text = text.Text[..cut];
                    text.Space = SpaceProcessingModeValues.Preserve;
                    text.InsertAfterSelf(tail);
                    SplitRunBefore(tail);
                    return;
                }

                offset += length;
            }
        }

        /// <summary>Moves <paramref name="atom"/> and everything after it in its run into a new run with the same properties.</summary>
        private static void SplitRunBefore(OpenXmlElement atom)
        {
            var run = (W.Run)atom.Parent!;
            if (run.ChildElements.TakeWhile(c => c != atom).All(c => c is W.RunProperties))
            {
                return;
            }

            var tail = (W.Run)run.CloneNode(false);
            if (run.RunProperties != null)
            {
                tail.Append(run.RunProperties.CloneNode(true));
            }

            foreach (var child in run.ChildElements.SkipWhile(c => c != atom).ToList())
            {
                child.Remove();
                tail.Append(child);
            }

            run.InsertAfterSelf(tail);
        }

        private static string Initials(string name)
            => string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(part => char.ToUpperInvariant(part[0])));
    }
}
