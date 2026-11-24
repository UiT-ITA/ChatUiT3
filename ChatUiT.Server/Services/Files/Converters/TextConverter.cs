namespace ChatUiT.Server.Services.Files.Converters;

internal static class TextConverter
{
    public static List<ConvertedPart> Convert(Stream content, string format)
    {
        using var reader = new StreamReader(content, leaveOpen: true);
        return [new ConvertedText(reader.ReadToEnd(), format)];
    }
}
