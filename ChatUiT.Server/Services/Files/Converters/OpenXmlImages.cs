using DocumentFormat.OpenXml.Packaging;

namespace ChatUiT.Server.Services.Files.Converters;

internal static class OpenXmlImages
{
    /// <summary>The picture a part refers to by relationship id. Null when there is none, or it is too small to keep.</summary>
    public static ConvertedImage? Read(OpenXmlPart owner, string? relationshipId)
    {
        if (string.IsNullOrEmpty(relationshipId))
        {
            return null;
        }

        var part = owner.Parts.FirstOrDefault(pair => pair.RelationshipId == relationshipId).OpenXmlPart;
        if (part == null)
        {
            return null;
        }

        using var stream = part.GetStream();
        return ImageConverter.Normalize(stream);
    }
}
