using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using ChatUiT.Server.Services.Agents.M365.Functions;
using ChatUiT.Server.Services.Tools;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using A = DocumentFormat.OpenXml.Drawing;
using P = DocumentFormat.OpenXml.Presentation;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>
/// Reads and edits .pptx files. Slides are numbered from 1 in presentation order and shapes by
/// their id on the slide; slide numbers in operations refer to the presentation as it was read.
/// </summary>
public static class PowerPointPresentations
{
    public const string MediaType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    public static string Read(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes, writable: false);
        using var document = PresentationDocument.Open(stream, false);
        var presentation = PresentationOf(document);

        var text = new StringBuilder();
        text.AppendLine("PowerPoint presentation. Slides are numbered from 1 and shapes by [shape id]. Use these with edit_powerpoint_presentation.");
        text.AppendLine($"Layouts: {string.Join(", ", Layouts(presentation).Select(l => $"\"{LayoutName(l)}\""))}");

        var slideIds = presentation.Presentation?.SlideIdList?.Elements<P.SlideId>().ToList() ?? [];
        for (var i = 0; i < slideIds.Count; i++)
        {
            var slidePart = SlidePartOf(presentation, slideIds[i]);
            text.AppendLine();
            text.AppendLine($"Slide {i + 1} (layout \"{(slidePart.SlideLayoutPart is { } layout ? LayoutName(layout) : string.Empty)}\")");

            foreach (var element in slidePart.Slide?.CommonSlideData?.ShapeTree?.Descendants() ?? [])
            {
                switch (element)
                {
                    case P.Shape shape:
                        var paragraphs = shape.TextBody?.Elements<A.Paragraph>().Select(ParagraphText).ToList() ?? [];
                        var placeholder = shape.NonVisualShapeProperties?.ApplicationNonVisualDrawingProperties?.PlaceholderShape;
                        var kind = placeholder == null ? string.Empty : $" ({placeholder.Type?.InnerText ?? "placeholder"})";
                        text.AppendLine($"  [shape {shape.NonVisualShapeProperties?.NonVisualDrawingProperties?.Id}] {shape.NonVisualShapeProperties?.NonVisualDrawingProperties?.Name}{kind}:");
                        foreach (var paragraph in paragraphs)
                        {
                            text.AppendLine($"      {paragraph}");
                        }

                        break;
                    case P.Picture picture:
                        text.AppendLine($"  [shape {picture.NonVisualPictureProperties?.NonVisualDrawingProperties?.Id}] {picture.NonVisualPictureProperties?.NonVisualDrawingProperties?.Name} (picture)");
                        break;
                    case P.GraphicFrame frame:
                        text.AppendLine($"  [shape {frame.NonVisualGraphicFrameProperties?.NonVisualDrawingProperties?.Id}] {frame.NonVisualGraphicFrameProperties?.NonVisualDrawingProperties?.Name} ({(frame.Descendants<A.Table>().Any() ? "table" : "graphic")}):");
                        foreach (var row in frame.Descendants<A.TableRow>())
                        {
                            text.AppendLine($"      {string.Join(" | ", row.Elements<A.TableCell>().Select(c => string.Join("\\n", c.Descendants<A.Paragraph>().Select(ParagraphText))))}");
                        }

                        break;
                }
            }

            var notes = slidePart.NotesSlidePart?.NotesSlide?.Descendants<P.Shape>()
                .Where(s => s.NonVisualShapeProperties?.ApplicationNonVisualDrawingProperties?.PlaceholderShape?.Type?.Value == P.PlaceholderValues.Body)
                .SelectMany(s => s.Descendants<A.Paragraph>().Select(ParagraphText))
                .ToList() ?? [];
            if (notes.Count > 0)
            {
                text.AppendLine($"  Notes: {string.Join("\\n", notes)}");
            }
        }

        return text.ToString();
    }

    /// <summary>Applies <paramref name="operations"/> in order and returns the new file and one summary line per operation.</summary>
    public static (byte[] Bytes, List<string> Changes) Apply(byte[] bytes, IReadOnlyList<PowerPointOperation> operations)
    {
        using var stream = new MemoryStream();
        stream.Write(bytes);
        stream.Position = 0;

        List<string> changes;
        using (var document = PresentationDocument.Open(stream, true))
        {
            changes = new Editor(PresentationOf(document)).Apply(operations);
        }

        return (stream.ToArray(), changes);
    }

    /// <summary>A new 16:9 presentation with <paramref name="slides"/>, or one empty title slide.</summary>
    public static byte[] Create(IReadOnlyList<NewSlide>? slides)
    {
        using var stream = new MemoryStream();
        using (var document = PresentationDocument.Create(stream, PresentationDocumentType.Presentation))
        {
            var presentation = PowerPointTemplate.Build(document);
            var operations = slides is { Count: > 0 }
                ? slides.Select(s => new PowerPointOperation(PowerPointOperationType.AddSlide, null, null, null, null, null, s.Layout, s.Title, s.Body, null)).ToList()
                : [new PowerPointOperation(PowerPointOperationType.AddSlide, null, null, null, null, null, PowerPointTemplate.TitleLayout, null, null, null)];
            new Editor(presentation).Apply(operations);
        }

        return stream.ToArray();
    }

    private static PresentationPart PresentationOf(PresentationDocument document)
        => document.PresentationPart ?? throw new ToolArgumentException("The file has no presentation.");

    private static SlidePart SlidePartOf(PresentationPart presentation, P.SlideId slideId)
        => (SlidePart)presentation.GetPartById(slideId.RelationshipId!.Value!);

    private static IEnumerable<SlideLayoutPart> Layouts(PresentationPart presentation)
        => presentation.SlideMasterParts.SelectMany(m => m.SlideLayoutParts);

    private static string LayoutName(SlideLayoutPart layout) => layout.SlideLayout?.CommonSlideData?.Name?.Value ?? string.Empty;

    private static P.Slide SlideOf(SlidePart part) => part.Slide ?? throw new ToolArgumentException("A slide has no content.");

    private static List<A.Text> Atoms(A.Paragraph paragraph) => paragraph.Descendants<A.Text>().ToList();

    private static string ParagraphText(A.Paragraph paragraph) => string.Concat(Atoms(paragraph).Select(t => t.Text));

    private sealed class Editor
    {
        private readonly PresentationPart _presentation;
        private readonly List<P.SlideId> _slides;
        private readonly Dictionary<OpenXmlElement, OpenXmlElement> _lastAfter = new();

        public Editor(PresentationPart presentation)
        {
            _presentation = presentation;
            Root.SlideIdList ??= new P.SlideIdList();
            _slides = SlideList.Elements<P.SlideId>().ToList();
        }

        private P.Presentation Root => _presentation.Presentation ?? throw new ToolArgumentException("The file has no presentation.");

        private P.SlideIdList SlideList => Root.SlideIdList!;

        public List<string> Apply(IReadOnlyList<PowerPointOperation> operations)
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

            return changes;
        }

        private string ApplyOne(PowerPointOperation op) => op.Type switch
        {
            PowerPointOperationType.SetShapeText => SetShapeText(op),
            PowerPointOperationType.ReplaceText => ReplaceText(op),
            PowerPointOperationType.AddSlide => AddSlide(op),
            PowerPointOperationType.DuplicateSlide => DuplicateSlide(op),
            PowerPointOperationType.DeleteSlide => DeleteSlide(op),
            PowerPointOperationType.MoveSlide => MoveSlide(op),
            _ => throw new ToolArgumentException("unknown operation type.")
        };

        private string SetShapeText(PowerPointOperation op)
        {
            var slide = SlidePartOf(_presentation, Slide(op.Slide));
            var text = op.Text ?? throw new ToolArgumentException("text is required.");
            var shapeId = op.Shape ?? throw new ToolArgumentException("shape is required.");
            var shape = SlideOf(slide).Descendants<P.Shape>().FirstOrDefault(s => s.NonVisualShapeProperties?.NonVisualDrawingProperties?.Id?.Value == (uint)shapeId)
                ?? throw new ToolArgumentException($"slide {op.Slide} has no text shape {shapeId}.");

            var body = shape.TextBody ?? shape.AppendChild(new P.TextBody(new A.BodyProperties(), new A.ListStyle()));
            var before = string.Join("\\n", body.Elements<A.Paragraph>().Select(ParagraphText));
            SetText(body, text);
            return $"Set slide {op.Slide} shape {shapeId}\n   Before: {RunText.Short(before, 300)}\n   After: {RunText.Short(text, 300)}";
        }

        private string ReplaceText(PowerPointOperation op)
        {
            var find = string.IsNullOrEmpty(op.Find) ? throw new ToolArgumentException("find is required.") : op.Find;
            var replace = op.Replace ?? throw new ToolArgumentException("replace is required (use an empty string to delete).");
            var slides = op.Slide != null ? [Slide(op.Slide)] : SlideList.Elements<P.SlideId>().ToList();

            var count = slides
                .SelectMany(s => SlideOf(SlidePartOf(_presentation, s)).Descendants<A.Paragraph>().ToList())
                .Sum(p => RunText.ReplaceAll(() => Atoms(p).Cast<OpenXmlElement>().ToList(), find, replace, (_, _) => { }));
            if (count == 0)
            {
                throw new ToolArgumentException($"\"{RunText.Short(find)}\" was not found{(op.Slide != null ? $" on slide {op.Slide}" : string.Empty)}.");
            }

            return $"Replace \"{RunText.Short(find)}\" with \"{RunText.Short(replace)}\"{(op.Slide != null ? $" on slide {op.Slide}" : string.Empty)} ({count}×)";
        }

        private string AddSlide(PowerPointOperation op)
        {
            var layout = Layout(op.Layout);
            var slidePart = _presentation.AddNewPart<SlidePart>();
            slidePart.AddPart(layout);

            var tree = new P.ShapeTree(
                new P.NonVisualGroupShapeProperties(
                    new P.NonVisualDrawingProperties { Id = 1, Name = string.Empty },
                    new P.NonVisualGroupShapeDrawingProperties(),
                    new P.ApplicationNonVisualDrawingProperties()),
                new P.GroupShapeProperties(new A.TransformGroup()));

            uint id = 2;
            P.Shape? title = null;
            P.Shape? body = null;
            foreach (var source in layout.SlideLayout?.CommonSlideData?.ShapeTree?.Elements<P.Shape>() ?? [])
            {
                var placeholder = source.NonVisualShapeProperties?.ApplicationNonVisualDrawingProperties?.PlaceholderShape;
                var type = placeholder?.Type?.Value;
                if (placeholder == null || type == P.PlaceholderValues.DateAndTime || type == P.PlaceholderValues.Footer || type == P.PlaceholderValues.SlideNumber)
                {
                    continue;
                }

                var shape = new P.Shape(
                    new P.NonVisualShapeProperties(
                        new P.NonVisualDrawingProperties { Id = id++, Name = source.NonVisualShapeProperties!.NonVisualDrawingProperties?.Name ?? "Placeholder" },
                        new P.NonVisualShapeDrawingProperties(new A.ShapeLocks { NoGrouping = true }),
                        new P.ApplicationNonVisualDrawingProperties((P.PlaceholderShape)placeholder.CloneNode(true))),
                    new P.ShapeProperties(),
                    new P.TextBody(new A.BodyProperties(), new A.ListStyle(), new A.Paragraph(new A.EndParagraphRunProperties())));
                tree.Append(shape);

                if (type == P.PlaceholderValues.Title || type == P.PlaceholderValues.CenteredTitle)
                {
                    title ??= shape;
                }
                else if (type == null || type == P.PlaceholderValues.Body || type == P.PlaceholderValues.SubTitle || type == P.PlaceholderValues.Object)
                {
                    body ??= shape;
                }
            }

            if (!string.IsNullOrEmpty(op.Title))
            {
                SetText(title?.TextBody ?? throw new ToolArgumentException($"layout \"{LayoutName(layout)}\" has no title placeholder."), op.Title);
            }

            if (!string.IsNullOrEmpty(op.Body))
            {
                SetText(body?.TextBody ?? throw new ToolArgumentException($"layout \"{LayoutName(layout)}\" has no body placeholder."), op.Body);
            }

            slidePart.Slide = new P.Slide(new P.CommonSlideData(tree), new P.ColorMapOverride(new A.MasterColorMapping()));
            var slideId = new P.SlideId { Id = NextSlideId(), RelationshipId = _presentation.GetIdOfPart(slidePart) };
            Insert(op.Slide != null ? Slide(op.Slide) : null, slideId);

            return $"Add slide {Where(op.Slide)} with layout \"{LayoutName(layout)}\"{(string.IsNullOrEmpty(op.Title) ? string.Empty : $": {RunText.Short(op.Title)}")}"
                + (string.IsNullOrEmpty(op.Body) ? string.Empty : $"\n   Body: {RunText.Short(op.Body, 300)}");
        }

        private string DuplicateSlide(PowerPointOperation op)
        {
            var sourceId = Slide(op.Slide);
            var source = SlidePartOf(_presentation, sourceId);
            SlideOf(source).Save();

            var copy = _presentation.AddNewPart<SlidePart>();
            using (var data = source.GetStream())
            {
                copy.FeedData(data);
            }

            foreach (var related in source.Parts.Where(p => p.OpenXmlPart is not NotesSlidePart))
            {
                copy.AddPart(related.OpenXmlPart, related.RelationshipId);
            }

            foreach (var external in source.ExternalRelationships)
            {
                copy.AddExternalRelationship(external.RelationshipType, external.Uri, external.Id);
            }

            foreach (var link in source.HyperlinkRelationships)
            {
                copy.AddHyperlinkRelationship(link.Uri, link.IsExternal, link.Id);
            }

            Insert(sourceId, new P.SlideId { Id = NextSlideId(), RelationshipId = _presentation.GetIdOfPart(copy) });
            return $"Duplicate slide {op.Slide} after it";
        }

        private string DeleteSlide(PowerPointOperation op)
        {
            var slideId = Slide(op.Slide);
            var relationshipId = slideId.RelationshipId!.Value!;
            var part = SlidePartOf(_presentation, slideId);
            var title = SlideOf(part).Descendants<P.Shape>()
                .Where(s => s.NonVisualShapeProperties?.ApplicationNonVisualDrawingProperties?.PlaceholderShape?.Type?.Value is { } t && (t == P.PlaceholderValues.Title || t == P.PlaceholderValues.CenteredTitle))
                .Select(s => string.Join(" ", s.Descendants<A.Paragraph>().Select(ParagraphText)))
                .FirstOrDefault();

            slideId.Remove();
            foreach (var entry in Root.CustomShowList?.Descendants<P.SlideListEntry>().Where(e => e.Id?.Value == relationshipId).ToList() ?? [])
            {
                entry.Remove();
            }

            _presentation.DeletePart(part);
            return $"Delete slide {op.Slide}{(string.IsNullOrEmpty(title) ? string.Empty : $": {RunText.Short(title)}")}";
        }

        private string MoveSlide(PowerPointOperation op)
        {
            var slideId = Slide(op.Slide);
            var count = SlideList.Elements<P.SlideId>().Count();
            if (op.Position is not int position || position < 1 || position > count)
            {
                throw new ToolArgumentException($"position must be between 1 and {count}.");
            }

            slideId.Remove();
            var remaining = SlideList.Elements<P.SlideId>().ToList();
            if (position > remaining.Count)
            {
                SlideList.Append(slideId);
            }
            else
            {
                remaining[position - 1].InsertBeforeSelf(slideId);
            }

            return $"Move slide {op.Slide} to position {position}";
        }

        private P.SlideId Slide(int? number)
        {
            if (number is not int n || n < 1 || n > _slides.Count)
            {
                throw new ToolArgumentException(_slides.Count == 0 ? "the presentation has no slides." : $"slide must be between 1 and {_slides.Count}.");
            }

            return _slides[n - 1].Parent != null ? _slides[n - 1] : throw new ToolArgumentException($"slide {n} was deleted by an earlier operation.");
        }

        private SlideLayoutPart Layout(string? name)
        {
            var layouts = Layouts(_presentation).ToList();
            if (layouts.Count == 0)
            {
                throw new ToolArgumentException("the presentation has no slide layouts.");
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                return layouts.FirstOrDefault(l => LayoutName(l).Equals(PowerPointTemplate.ContentLayout, StringComparison.OrdinalIgnoreCase))
                    ?? layouts.FirstOrDefault(l => l.SlideLayout?.Type?.Value == P.SlideLayoutValues.Object)
                    ?? layouts[0];
            }

            return layouts.FirstOrDefault(l => LayoutName(l).Equals(name.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new ToolArgumentException($"layout \"{name}\" does not exist. Use one of: {string.Join(", ", layouts.Select(l => $"\"{LayoutName(l)}\""))}.");
        }

        private uint NextSlideId()
            => Math.Max(255u, SlideList.Elements<P.SlideId>().Select(s => s.Id?.Value ?? 0).DefaultIfEmpty(0u).Max()) + 1;

        private void Insert(P.SlideId? anchor, P.SlideId slideId)
        {
            if (anchor == null)
            {
                SlideList.Append(slideId);
                return;
            }

            var after = _lastAfter.TryGetValue(anchor, out var last) && last.Parent != null ? last : anchor;
            after.InsertAfterSelf(slideId);
            _lastAfter[anchor] = slideId;
        }

        private static string Where(int? slide) => slide != null ? $"after slide {slide}" : "at the end";

        /// <summary>Replaces the text body's paragraphs with one per line, in the formatting of its first paragraph and run.</summary>
        private static void SetText(OpenXmlCompositeElement body, string text)
        {
            var first = body.Elements<A.Paragraph>().FirstOrDefault();
            var paragraphProperties = first?.ParagraphProperties;
            var runProperties = first?.Descendants<A.RunProperties>().FirstOrDefault();

            body.RemoveAllChildren<A.Paragraph>();
            foreach (var line in text.Replace("\r\n", "\n").Split('\n'))
            {
                var paragraph = new A.Paragraph();
                if (paragraphProperties != null)
                {
                    paragraph.Append(paragraphProperties.CloneNode(true));
                }

                if (line.Length > 0)
                {
                    var run = new A.Run();
                    if (runProperties != null)
                    {
                        run.Append(runProperties.CloneNode(true));
                    }

                    run.Append(new A.Text(line));
                    paragraph.Append(run);
                }
                else
                {
                    paragraph.Append(new A.EndParagraphRunProperties());
                }

                body.Append(paragraph);
            }
        }
    }
}
