using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using A = DocumentFormat.OpenXml.Drawing;
using P = DocumentFormat.OpenXml.Presentation;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>The parts of an empty 16:9 presentation: one master, a title layout, a title and content layout, and a theme.</summary>
internal static class PowerPointTemplate
{
    public const string TitleLayout = "Title Slide";
    public const string ContentLayout = "Title and Content";

    private const long SlideWidth = 12192000;
    private const long SlideHeight = 6858000;

    public static PresentationPart Build(PresentationDocument document)
    {
        var presentation = document.AddPresentationPart();
        presentation.Presentation = new P.Presentation();

        var master = presentation.AddNewPart<SlideMasterPart>("rId1");
        var theme = master.AddNewPart<ThemePart>("rId1");
        theme.Theme = Theme();
        presentation.AddPart(theme, "rId2");

        var title = master.AddNewPart<SlideLayoutPart>("rId2");
        title.SlideLayout = Layout(TitleLayout, P.SlideLayoutValues.Title,
            Placeholder(2, "Title 1", P.PlaceholderValues.CenteredTitle, null, Transform(1524000, 1122363, 9144000, 2387600), A.TextAnchoringTypeValues.Bottom, centered: true),
            Placeholder(3, "Subtitle 2", P.PlaceholderValues.SubTitle, 1, Transform(1524000, 3602038, 9144000, 1655762), null, centered: true));
        title.AddPart(master);

        var content = master.AddNewPart<SlideLayoutPart>("rId3");
        content.SlideLayout = Layout(ContentLayout, P.SlideLayoutValues.Object,
            Placeholder(2, "Title 1", P.PlaceholderValues.Title, null, null, null, centered: false),
            Placeholder(3, "Content Placeholder 2", null, 1, null, null, centered: false));
        content.AddPart(master);

        master.SlideMaster = new P.SlideMaster(
            new P.CommonSlideData(
                new P.Background(new P.BackgroundStyleReference(new A.SchemeColor { Val = A.SchemeColorValues.Background1 }) { Index = 1001 }),
                ShapeTree(
                    Placeholder(2, "Title Placeholder 1", P.PlaceholderValues.Title, null, Transform(838200, 365125, 10515600, 1325563), A.TextAnchoringTypeValues.Center, centered: false),
                    Placeholder(3, "Text Placeholder 2", P.PlaceholderValues.Body, 1, Transform(838200, 1825625, 10515600, 4351338), null, centered: false))),
            new P.ColorMap
            {
                Background1 = A.ColorSchemeIndexValues.Light1,
                Text1 = A.ColorSchemeIndexValues.Dark1,
                Background2 = A.ColorSchemeIndexValues.Light2,
                Text2 = A.ColorSchemeIndexValues.Dark2,
                Accent1 = A.ColorSchemeIndexValues.Accent1,
                Accent2 = A.ColorSchemeIndexValues.Accent2,
                Accent3 = A.ColorSchemeIndexValues.Accent3,
                Accent4 = A.ColorSchemeIndexValues.Accent4,
                Accent5 = A.ColorSchemeIndexValues.Accent5,
                Accent6 = A.ColorSchemeIndexValues.Accent6,
                Hyperlink = A.ColorSchemeIndexValues.Hyperlink,
                FollowedHyperlink = A.ColorSchemeIndexValues.FollowedHyperlink
            },
            new P.SlideLayoutIdList(
                new P.SlideLayoutId { Id = 2147483649U, RelationshipId = "rId2" },
                new P.SlideLayoutId { Id = 2147483650U, RelationshipId = "rId3" }),
            new P.TextStyles(
                new P.TitleStyle(
                    new A.Level1ParagraphProperties(
                        new A.LineSpacing(new A.SpacingPercent { Val = 90000 }),
                        new A.SpaceBefore(new A.SpacingPercent { Val = 0 }),
                        new A.NoBullet(),
                        RunDefaults(4400, "+mj-lt"))
                    { Alignment = A.TextAlignmentTypeValues.Left }),
                new P.BodyStyle(
                    BodyLevel(new A.Level1ParagraphProperties(), 228600, 228600, 2800),
                    BodyLevel(new A.Level2ParagraphProperties(), 685800, 228600, 2400),
                    BodyLevel(new A.Level3ParagraphProperties(), 1143000, 228600, 2000)),
                new P.OtherStyle()));

        presentation.Presentation.Append(
            new P.SlideMasterIdList(new P.SlideMasterId { Id = 2147483648U, RelationshipId = "rId1" }),
            new P.SlideIdList(),
            new P.SlideSize { Cx = (int)SlideWidth, Cy = (int)SlideHeight },
            new P.NotesSize { Cx = 6858000, Cy = 9144000 },
            new P.DefaultTextStyle());

        return presentation;
    }

    private static P.SlideLayout Layout(string name, P.SlideLayoutValues type, params P.Shape[] shapes)
        => new(new P.CommonSlideData(ShapeTree(shapes)) { Name = name }, new P.ColorMapOverride(new A.MasterColorMapping()))
        {
            Type = type,
            Preserve = true
        };

    private static P.ShapeTree ShapeTree(params P.Shape[] shapes)
    {
        var tree = new P.ShapeTree(
            new P.NonVisualGroupShapeProperties(
                new P.NonVisualDrawingProperties { Id = 1, Name = string.Empty },
                new P.NonVisualGroupShapeDrawingProperties(),
                new P.ApplicationNonVisualDrawingProperties()),
            new P.GroupShapeProperties(new A.TransformGroup(
                new A.Offset { X = 0, Y = 0 },
                new A.Extents { Cx = 0, Cy = 0 },
                new A.ChildOffset { X = 0, Y = 0 },
                new A.ChildExtents { Cx = 0, Cy = 0 })));
        tree.Append(shapes);
        return tree;
    }

    private static A.Transform2D Transform(long x, long y, long width, long height)
        => new(new A.Offset { X = x, Y = y }, new A.Extents { Cx = width, Cy = height });

    private static P.Shape Placeholder(uint id, string name, P.PlaceholderValues? type, uint? index, A.Transform2D? transform, A.TextAnchoringTypeValues? anchor, bool centered)
    {
        var placeholder = new P.PlaceholderShape();
        if (type is { } t)
        {
            placeholder.Type = t;
        }

        if (index is { } i)
        {
            placeholder.Index = i;
        }

        var bodyProperties = new A.BodyProperties();
        if (anchor is { } a)
        {
            bodyProperties.Anchor = a;
        }

        var listStyle = new A.ListStyle();
        if (centered)
        {
            listStyle.Append(new A.Level1ParagraphProperties(new A.NoBullet()) { LeftMargin = 0, Indent = 0, Alignment = A.TextAlignmentTypeValues.Center });
        }

        return new P.Shape(
            new P.NonVisualShapeProperties(
                new P.NonVisualDrawingProperties { Id = id, Name = name },
                new P.NonVisualShapeDrawingProperties(new A.ShapeLocks { NoGrouping = true }),
                new P.ApplicationNonVisualDrawingProperties(placeholder)),
            transform != null ? new P.ShapeProperties(transform) : new P.ShapeProperties(),
            new P.TextBody(bodyProperties, listStyle, new A.Paragraph(new A.EndParagraphRunProperties())));
    }

    private static T BodyLevel<T>(T level, int leftMargin, int indent, int size) where T : A.TextParagraphPropertiesType
    {
        level.LeftMargin = leftMargin;
        level.Indent = -indent;
        level.Append(
            new A.LineSpacing(new A.SpacingPercent { Val = 90000 }),
            new A.SpaceBefore(new A.SpacingPoints { Val = 1000 }),
            new A.BulletFont { Typeface = "Arial" },
            new A.CharacterBullet { Char = "•" },
            RunDefaults(size, "+mn-lt"));
        return level;
    }

    private static A.DefaultRunProperties RunDefaults(int size, string font)
        => new(
            new A.SolidFill(new A.SchemeColor { Val = A.SchemeColorValues.Text1 }),
            new A.LatinFont { Typeface = font },
            new A.EastAsianFont { Typeface = font.Replace("lt", "ea") },
            new A.ComplexScriptFont { Typeface = font.Replace("lt", "cs") })
        { FontSize = size, Kerning = 1200 };

    private static A.Theme Theme()
    {
        static A.SolidFill Placeholder() => new(new A.SchemeColor { Val = A.SchemeColorValues.PhColor });

        return new A.Theme(
            new A.ThemeElements(
                new A.ColorScheme(
                    new A.Dark1Color(new A.SystemColor { Val = A.SystemColorValues.WindowText, LastColor = "000000" }),
                    new A.Light1Color(new A.SystemColor { Val = A.SystemColorValues.Window, LastColor = "FFFFFF" }),
                    new A.Dark2Color(new A.RgbColorModelHex { Val = "0E2841" }),
                    new A.Light2Color(new A.RgbColorModelHex { Val = "E8E8E8" }),
                    new A.Accent1Color(new A.RgbColorModelHex { Val = "156082" }),
                    new A.Accent2Color(new A.RgbColorModelHex { Val = "E97132" }),
                    new A.Accent3Color(new A.RgbColorModelHex { Val = "196B24" }),
                    new A.Accent4Color(new A.RgbColorModelHex { Val = "0F9ED5" }),
                    new A.Accent5Color(new A.RgbColorModelHex { Val = "A02B93" }),
                    new A.Accent6Color(new A.RgbColorModelHex { Val = "4EA72E" }),
                    new A.Hyperlink(new A.RgbColorModelHex { Val = "467886" }),
                    new A.FollowedHyperlinkColor(new A.RgbColorModelHex { Val = "96607D" }))
                { Name = "Office" },
                new A.FontScheme(
                    new A.MajorFont(new A.LatinFont { Typeface = "Aptos Display" }, new A.EastAsianFont { Typeface = string.Empty }, new A.ComplexScriptFont { Typeface = string.Empty }),
                    new A.MinorFont(new A.LatinFont { Typeface = "Aptos" }, new A.EastAsianFont { Typeface = string.Empty }, new A.ComplexScriptFont { Typeface = string.Empty }))
                { Name = "Office" },
                new A.FormatScheme(
                    new A.FillStyleList(Placeholder(), Placeholder(), Placeholder()),
                    new A.LineStyleList(
                        new A.Outline(Placeholder()) { Width = 12700 },
                        new A.Outline(Placeholder()) { Width = 19050 },
                        new A.Outline(Placeholder()) { Width = 25400 }),
                    new A.EffectStyleList(
                        new A.EffectStyle(new A.EffectList()),
                        new A.EffectStyle(new A.EffectList()),
                        new A.EffectStyle(new A.EffectList())),
                    new A.BackgroundFillStyleList(Placeholder(), Placeholder(), Placeholder()))
                { Name = "Office" }),
            new A.ObjectDefaults(),
            new A.ExtraColorSchemeList())
        { Name = "Office Theme" };
    }
}
