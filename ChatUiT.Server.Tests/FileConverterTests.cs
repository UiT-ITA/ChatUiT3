using System.Text;
using ChatUiT.Server.Errors;
using ChatUiT.Server.Services.Files;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using SkiaSharp;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Fonts.Standard14Fonts;
using UglyToad.PdfPig.Writer;
using A = DocumentFormat.OpenXml.Drawing;
using P = DocumentFormat.OpenXml.Presentation;
using S = DocumentFormat.OpenXml.Spreadsheet;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace ChatUiT.Server.Tests;

public class FileConverterTests
{
    private readonly FileConversionService _converter = new();

    private async Task<IReadOnlyList<ConvertedPart>> ConvertAsync(string fileName, byte[] content)
    {
        var kind = FileKinds.Resolve(fileName, null);
        Assert.NotNull(kind);
        return (await _converter.ConvertAsync(kind.Value, new MemoryStream(content), default)).Parts;
    }

    private async Task<ErrorCode> ConvertErrorAsync(string fileName, byte[] content)
        => (await Assert.ThrowsAsync<FileConversionException>(() => ConvertAsync(fileName, content))).Error;

    private static byte[] Image(int width, int height, SKEncodedImageFormat format = SKEncodedImageFormat.Png)
    {
        using var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(SKColors.CornflowerBlue);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 90);
        return data.ToArray();
    }

    private static (int Width, int Height) SizeOf(ConvertedImage image)
    {
        using var decoded = SKBitmap.Decode(image.Data);
        Assert.Equal((image.Width, image.Height), (decoded.Width, decoded.Height));
        Assert.Equal("image/jpeg", image.MediaType);
        Assert.Equal(new byte[] { 0xFF, 0xD8 }, image.Data[..2]);
        return (decoded.Width, decoded.Height);
    }

    [Theory]
    [InlineData("notes.txt", FileKind.Text)]
    [InlineData("data.CSV", FileKind.Text)]
    [InlineData("data.json", FileKind.Text)]
    [InlineData("readme.md", FileKind.Markdown)]
    [InlineData("readme.markdown", FileKind.Markdown)]
    [InlineData("photo.jpeg", FileKind.Image)]
    [InlineData("photo.bmp", FileKind.Image)]
    [InlineData("paper.pdf", FileKind.Pdf)]
    [InlineData("paper.docx", FileKind.Docx)]
    [InlineData("slides.pptx", FileKind.Pptx)]
    [InlineData("sheet.xlsx", FileKind.Xlsx)]
    public void Accepted_file_types_resolve_to_their_kind(string fileName, FileKind kind)
    {
        Assert.Equal(kind, FileKinds.Resolve(fileName, null));
    }

    [Theory]
    [InlineData("program.exe", null)]
    [InlineData("old.doc", "application/msword")]
    [InlineData("noextension", null)]
    public void Other_file_types_are_not_accepted(string fileName, string? contentType)
    {
        Assert.Null(FileKinds.Resolve(fileName, contentType));
    }

    [Fact]
    public void A_file_without_a_known_extension_is_resolved_from_its_content_type()
    {
        Assert.Equal(FileKind.Image, FileKinds.Resolve("pasted", "image/png"));
        Assert.Equal(FileKind.Text, FileKinds.Resolve("pasted", "text/plain; charset=utf-8"));
    }

    [Theory]
    [InlineData("notes.txt", "plain")]
    [InlineData("data.csv", "plain")]
    [InlineData("data.json", "plain")]
    [InlineData("readme.md", "markdown")]
    public async Task Text_files_become_one_text_part(string fileName, string format)
    {
        var parts = await ConvertAsync(fileName, Encoding.UTF8.GetBytes("Blåbær, 1\nline two"));

        Assert.Equal([new ConvertedText("Blåbær, 1\nline two", format)], parts);
    }

    [Fact]
    public async Task An_empty_text_file_has_no_parts()
    {
        Assert.Empty(await ConvertAsync("empty.txt", []));
    }

    [Theory]
    [InlineData(4000, 1000, 2048, 512)]
    [InlineData(3000, 2000, 1536, 1024)]
    [InlineData(1000, 4000, 512, 2048)]
    [InlineData(2000, 3000, 1024, 1536)]
    [InlineData(800, 600, 800, 600)]
    [InlineData(1500, 1500, 1024, 1024)]
    public async Task Images_are_limited_to_2048_by_1024_and_saved_as_jpeg(int width, int height, int expectedWidth, int expectedHeight)
    {
        var parts = await ConvertAsync("photo.png", Image(width, height));

        Assert.Equal((expectedWidth, expectedHeight), SizeOf(Assert.IsType<ConvertedImage>(Assert.Single(parts))));
    }

    [Theory]
    [InlineData(SKEncodedImageFormat.Jpeg, "photo.jpg")]
    [InlineData(SKEncodedImageFormat.Webp, "photo.webp")]
    public async Task Other_image_formats_are_read(SKEncodedImageFormat format, string fileName)
    {
        var parts = await ConvertAsync(fileName, Image(300, 200, format));

        Assert.Equal((300, 200), SizeOf(Assert.IsType<ConvertedImage>(Assert.Single(parts))));
    }

    [Fact]
    public async Task An_image_under_100_px_on_a_side_is_dropped()
    {
        Assert.Empty(await ConvertAsync("icon.png", Image(99, 500)));
    }

    [Fact]
    public async Task A_file_that_is_not_an_image_fails_as_unreadable()
    {
        Assert.Equal(ErrorCodes.ImageUnreadable, await ConvertErrorAsync("photo.png", Encoding.UTF8.GetBytes("not an image")));
    }

    private static byte[] Pdf(Action<PdfDocumentBuilder, PdfDocumentBuilder.AddedFont> build)
    {
        var builder = new PdfDocumentBuilder();
        build(builder, builder.AddStandard14Font(Standard14Font.Helvetica));
        return builder.Build();
    }

    [Fact]
    public async Task A_pdf_page_with_only_text_becomes_text()
    {
        var pdf = Pdf((builder, font) =>
        {
            var page = builder.AddPage(595, 842);
            page.AddText("First line", 12, new PdfPoint(50, 780), font);
            page.AddText("Second line", 12, new PdfPoint(50, 760), font);
            page.AddText("right", 12, new PdfPoint(300, 760), font);
            builder.AddPage(595, 842).AddText("Page two", 12, new PdfPoint(50, 780), font);
        });

        var parts = await ConvertAsync("paper.pdf", pdf);

        Assert.Equal([new ConvertedText("First line\nSecond line right\n\nPage two\n\n", "plain")], parts);
    }

    [Fact]
    public async Task A_pdf_page_with_an_image_is_also_rendered()
    {
        var pdf = Pdf((builder, font) =>
        {
            var page = builder.AddPage(595, 842);
            page.AddText("Figure 1", 12, new PdfPoint(50, 780), font);
            page.AddPng(Image(400, 300), new PdfRectangle(50, 300, 450, 600));
        });

        var parts = await ConvertAsync("paper.pdf", pdf);

        Assert.Equal(2, parts.Count);
        Assert.Equal(new ConvertedText("Figure 1\n\n", "plain"), parts[0]);
        Assert.Equal((1024, 1449), SizeOf(Assert.IsType<ConvertedImage>(parts[1])));
    }

    [Fact]
    public async Task A_pdf_page_without_text_is_rendered()
    {
        var pdf = Pdf((builder, _) => builder.AddPage(842, 595));

        var parts = await ConvertAsync("scan.pdf", pdf);

        Assert.Equal((1449, 1024), SizeOf(Assert.IsType<ConvertedImage>(Assert.Single(parts))));
    }

    [Fact]
    public async Task An_image_repeated_on_most_pdf_pages_does_not_make_them_render()
    {
        var logo = Image(200, 200);
        var pdf = Pdf((builder, font) =>
        {
            for (var number = 1; number <= 3; number++)
            {
                var page = builder.AddPage(595, 842);
                page.AddText($"Page {number}", 12, new PdfPoint(50, 700), font);
                page.AddPng(logo, new PdfRectangle(50, 400, 300, 650));
            }
        });

        var parts = await ConvertAsync("paper.pdf", pdf);

        Assert.Equal([new ConvertedText("Page 1\n\nPage 2\n\nPage 3\n\n", "plain")], parts);
    }

    [Fact]
    public async Task A_file_that_is_not_a_pdf_fails_as_invalid()
    {
        Assert.Equal(ErrorCodes.PdfInvalid, await ConvertErrorAsync("paper.pdf", Encoding.UTF8.GetBytes("not a pdf")));
    }

    private static W.Paragraph Paragraph(string text, string? style = null, bool numbered = false)
    {
        var paragraph = new W.Paragraph();
        var properties = new W.ParagraphProperties();
        if (style != null)
        {
            properties.Append(new W.ParagraphStyleId { Val = style });
        }
        if (numbered)
        {
            properties.Append(new W.NumberingProperties(new W.NumberingLevelReference { Val = 0 }, new W.NumberingId { Val = 1 }));
        }
        paragraph.Append(properties);
        paragraph.Append(new W.Run(new W.Text(text) { Space = SpaceProcessingModeValues.Preserve }));
        return paragraph;
    }

    private static W.Paragraph Picture(string relationshipId)
        => new(new W.Run(new W.Drawing(new A.Graphic(new A.GraphicData(new A.Blip { Embed = relationshipId })))));

    private static byte[] Docx()
    {
        var stream = new MemoryStream();
        using (var document = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document))
        {
            var main = document.AddMainDocumentPart();
            var image = main.AddImagePart(ImagePartType.Png);
            image.FeedData(new MemoryStream(Image(300, 200)));

            var table = new W.Table(
                new W.TableRow(new W.TableCell(Paragraph("Name")), new W.TableCell(Paragraph("Value"))),
                new W.TableRow(new W.TableCell(Paragraph("a|b")), new W.TableCell(Paragraph("2"))));

            main.Document = new W.Document(new W.Body(
                Paragraph("Title", "Heading1"),
                Paragraph("Some   body\ttext."),
                Paragraph("An item", numbered: true),
                Picture(main.GetIdOfPart(image)),
                table,
                Paragraph("The end")));
        }

        return stream.ToArray();
    }

    [Fact]
    public async Task A_docx_becomes_markdown_with_its_pictures_in_place()
    {
        var parts = await ConvertAsync("paper.docx", Docx());

        Assert.Equal(3, parts.Count);
        Assert.Equal(new ConvertedText("# Title\n\nSome body text.\n\n- An item\n\n", "markdown"), parts[0]);
        Assert.Equal((300, 200), SizeOf(Assert.IsType<ConvertedImage>(parts[1])));
        Assert.Equal(new ConvertedText("| Name | Value |\n| --- | --- |\n| a\\|b | 2 |\n\nThe end\n\n", "markdown"), parts[2]);
    }

    [Fact]
    public async Task A_file_that_is_not_a_docx_fails_to_open()
    {
        Assert.Equal(ErrorCodes.DocxOpenFailed, await ConvertErrorAsync("paper.docx", Encoding.UTF8.GetBytes("not a docx")));
    }

    private static P.Shape TextShape(params (string Text, bool Bullet)[] paragraphs)
    {
        var body = new P.TextBody(new A.BodyProperties());
        foreach (var (text, bullet) in paragraphs)
        {
            var paragraph = new A.Paragraph();
            if (bullet)
            {
                paragraph.Append(new A.ParagraphProperties(new A.CharacterBullet { Char = "•" }));
            }
            paragraph.Append(new A.Run(new A.Text(text)));
            body.Append(paragraph);
        }

        return new P.Shape(body);
    }

    private static void AddSlide(PresentationPart presentation, string id, params OpenXmlElement[] shapes)
    {
        var slide = presentation.AddNewPart<SlidePart>(id);
        slide.Slide = new P.Slide(new P.CommonSlideData(new P.ShapeTree(shapes)));
    }

    private static byte[] Pptx()
    {
        var stream = new MemoryStream();
        using (var document = PresentationDocument.Create(stream, PresentationDocumentType.Presentation))
        {
            var presentation = document.AddPresentationPart();
            presentation.Presentation = new P.Presentation();

            AddSlide(presentation, "rId1", TextShape(("Slide one", false), ("A point", true)));

            var second = presentation.AddNewPart<SlidePart>("rId2");
            var image = second.AddImagePart(ImagePartType.Png);
            image.FeedData(new MemoryStream(Image(300, 200)));
            var table = new A.Table(
                new A.TableRow(new A.TableCell(new A.TextBody(new A.Paragraph(new A.Run(new A.Text("H1"))))), new A.TableCell(new A.TextBody(new A.Paragraph(new A.Run(new A.Text("H2")))))),
                new A.TableRow(new A.TableCell(new A.TextBody(new A.Paragraph(new A.Run(new A.Text("1"))))), new A.TableCell(new A.TextBody(new A.Paragraph(new A.Run(new A.Text("2")))))));
            second.Slide = new P.Slide(new P.CommonSlideData(new P.ShapeTree(
                new P.Picture(new P.BlipFill(new A.Blip { Embed = second.GetIdOfPart(image) })),
                new P.GroupShape(TextShape(("In a group", false))),
                new P.GraphicFrame(new A.Graphic(new A.GraphicData(table))))));
        }

        return stream.ToArray();
    }

    [Fact]
    public async Task A_pptx_becomes_markdown_slide_by_slide_with_its_pictures()
    {
        var parts = await ConvertAsync("slides.pptx", Pptx());

        Assert.Equal(3, parts.Count);
        Assert.Equal(new ConvertedText("Slide one\n\n- A point\n\n", "markdown"), parts[0]);
        Assert.Equal((300, 200), SizeOf(Assert.IsType<ConvertedImage>(parts[1])));
        Assert.Equal(new ConvertedText("In a group\n\n| H1 | H2 |\n| --- | --- |\n| 1 | 2 |\n\n", "markdown"), parts[2]);
    }

    [Fact]
    public async Task A_file_that_is_not_a_pptx_fails_to_open()
    {
        Assert.Equal(ErrorCodes.PptxOpenFailed, await ConvertErrorAsync("slides.pptx", Encoding.UTF8.GetBytes("not a pptx")));
    }

    private static S.Cell Cell(string reference, string value, S.CellValues? type = null, uint? style = null)
    {
        var cell = new S.Cell { CellReference = reference, CellValue = new S.CellValue(value) };
        if (type != null)
        {
            cell.DataType = type.Value;
        }
        if (style != null)
        {
            cell.StyleIndex = style.Value;
        }
        return cell;
    }

    private static byte[] Xlsx()
    {
        var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook))
        {
            var workbook = document.AddWorkbookPart();

            var strings = workbook.AddNewPart<SharedStringTablePart>();
            strings.SharedStringTable = new S.SharedStringTable(
                new S.SharedStringItem(new S.Text("Name")),
                new S.SharedStringItem(new S.Text("When")),
                new S.SharedStringItem(new S.Run(new S.Text("Rich ")), new S.Run(new S.Text("text"))));

            var styles = workbook.AddNewPart<WorkbookStylesPart>();
            styles.Stylesheet = new S.Stylesheet(new S.CellFormats(new S.CellFormat { NumberFormatId = 0 }, new S.CellFormat { NumberFormatId = 14 }));

            var first = workbook.AddNewPart<WorksheetPart>();
            first.Worksheet = new S.Worksheet(new S.SheetData(
                new S.Row(Cell("A1", "0", S.CellValues.SharedString), Cell("B1", "1", S.CellValues.SharedString), Cell("D1", "Total", S.CellValues.String)) { RowIndex = 1 },
                new S.Row(Cell("A2", "2", S.CellValues.SharedString), Cell("B2", "45292", style: 1), Cell("D2", "1.5")) { RowIndex = 2 },
                new S.Row(Cell("A4", "1", S.CellValues.Boolean), Cell("B4", "a|b", S.CellValues.String)) { RowIndex = 4 }));

            var second = workbook.AddNewPart<WorksheetPart>();
            second.Worksheet = new S.Worksheet(new S.SheetData(new S.Row(Cell("A1", "Other sheet", S.CellValues.String)) { RowIndex = 1 }));

            workbook.Workbook = new S.Workbook(new S.Sheets(
                new S.Sheet { Name = "One", SheetId = 1, Id = workbook.GetIdOfPart(first) },
                new S.Sheet { Name = "Two", SheetId = 2, Id = workbook.GetIdOfPart(second) }));
        }

        return stream.ToArray();
    }

    [Fact]
    public async Task An_xlsx_becomes_one_markdown_table_per_sheet()
    {
        var parts = await ConvertAsync("sheet.xlsx", Xlsx());

        var expected =
            "| Name | When |  | Total |\n| --- | --- | --- | --- |\n| Rich text | 2024-01-01T00:00:00.000Z |  | 1.5 |\n| true | a\\|b |  |  |\n\n" +
            "| Other sheet |\n| --- |\n\n";
        Assert.Equal([new ConvertedText(expected, "markdown")], parts);
    }

    [Fact]
    public async Task A_file_that_is_not_an_xlsx_fails_to_open()
    {
        Assert.Equal(ErrorCodes.XlsxOpenFailed, await ConvertErrorAsync("sheet.xlsx", Encoding.UTF8.GetBytes("not an xlsx")));
    }

    [Fact]
    public async Task Only_as_many_conversions_as_cpu_cores_run_at_once()
    {
        var running = 0;
        var most = 0;
        var gate = new object();
        var streams = Enumerable.Range(0, Environment.ProcessorCount * 3).Select(_ => new ProbeStream(() =>
        {
            lock (gate)
            {
                most = Math.Max(most, ++running);
            }
            Thread.Sleep(30);
            lock (gate)
            {
                running--;
            }
        })).ToList();

        await Task.WhenAll(streams.Select(stream => _converter.ConvertAsync(FileKind.Text, stream, default)));

        Assert.InRange(most, 1, Environment.ProcessorCount);
    }

    /// <summary>An empty stream that runs a callback when it is first read.</summary>
    private sealed class ProbeStream(Action onRead) : MemoryStream
    {
        private bool _read;

        public override int Read(Span<byte> buffer)
        {
            if (!_read)
            {
                _read = true;
                onRead();
            }

            return 0;
        }

        public override int Read(byte[] buffer, int offset, int count) => Read(buffer.AsSpan(offset, count));
    }
}
