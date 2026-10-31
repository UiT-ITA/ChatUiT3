using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.TokenCounting;

/// <summary>How text is turned into tokens.</summary>
public enum TextEncoding
{
    /// <summary>tiktoken o200k_base (gpt-4o and later).</summary>
    O200kBase,

    /// <summary>tiktoken cl100k_base (gpt-4, gpt-3.5).</summary>
    Cl100kBase,

    /// <summary>
    /// No tokenizer: characters divided by the scheme's <see cref="TokenCountingScheme.CharsPerToken"/>.
    /// For models with no public tokenizer. Anthropic documents roughly 3.5 English
    /// characters per token; 4 is the usual rule of thumb elsewhere.
    /// </summary>
    CharEstimate,

    /// <summary>No tokenizer: one token per whitespace-separated word. A rough fallback.</summary>
    WordCount
}

public abstract record ImageCostRule;

/// <summary>OpenAI tile pricing: a base cost plus a cost per 512px tile after scaling.</summary>
public sealed record TileImageCost(int BaseTokens, int TokensPerTile) : ImageCostRule;

/// <summary>OpenAI patch pricing (mini/nano models): 32px patches capped at 1536, times a multiplier.</summary>
public sealed record PatchImageCost(double Multiplier) : ImageCostRule;

/// <summary>Anthropic pricing: pixels divided by a constant (750).</summary>
public sealed record AreaImageCost(int PixelsPerToken) : ImageCostRule;

/// <summary>
/// A named way of counting tokens. The id is what gets stored on messages and models, so
/// it must stay stable once in use. <paramref name="CharsPerToken"/> is set only for
/// <see cref="TextEncoding.CharEstimate"/>. <paramref name="CountsImages"/> is false for the
/// text-only variant, which counts images as the note sent in their place.
/// </summary>
public sealed record TokenCountingScheme(string Id, TextEncoding Encoding, ImageCostRule ImageCost, bool IsEstimate, double? CharsPerToken = null, bool CountsImages = true)
{
    /// <summary>What decides a text count. Schemes sharing this share their text tokens.</summary>
    public (TextEncoding Encoding, double? CharsPerToken) TextRule => (Encoding, CharsPerToken);
}

/// <summary>
/// The scheme registry. Ids are parsed, not looked up, so a variant such as a different tile
/// cost is a matter of writing a new id rather than editing code.
/// </summary>
public static class TokenCountingSchemes
{
    public const string O200kTile = "o200k-tile";
    public const string Cl100kTile = "cl100k-tile";
    public const string AnthropicEstimate = "anthropic-estimate";
    public const string WordCount = "word-count";

    /// <summary>Appended to a scheme id for models without vision. Never stored on a model.</summary>
    public const string TextOnlySuffix = ":text-only";

    private const string O200kTilePrefix = "o200k-tile-";
    private const string Cl100kTilePrefix = "cl100k-tile-";
    private const string O200kPatchPrefix = "o200k-patch-";
    private const string CharEstimatePrefix = "char-est-";

    private const int DefaultTileBase = 85;
    private const int DefaultTilePerTile = 170;
    private const double AnthropicCharsPerToken = 3.5;
    private const double MaxCharsPerToken = 20;
    // Anthropic's image rule, also used by the generic estimates since they have none of their own.
    private const int EstimatePixelsPerToken = 750;

    public static string O200kPatch(double multiplier) =>
        O200kPatchPrefix + multiplier.ToString("0.##", CultureInfo.InvariantCulture);

    /// <summary>"char-est-4": characters divided by four.</summary>
    public static string CharEstimate(double charsPerToken) =>
        CharEstimatePrefix + charsPerToken.ToString("0.##", CultureInfo.InvariantCulture);

    /// <summary>Trimmed and lower-cased; null for blank input.</summary>
    public static string? Normalize(string? id)
    {
        var trimmed = id?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    public static bool IsKnown(string? id) => TryParse(id, out _);

    /// <summary>
    /// The id a model's counts are stored and read under: its scheme, made text-only when the
    /// model cannot read images. Null when the model has no counter.
    /// </summary>
    public static string? IdFor(LanguageModelCapabilities capabilities)
    {
        if (!TryParse(capabilities.TokenCountingScheme, out var scheme))
        {
            return null;
        }

        return capabilities.SupportsVision || !scheme.CountsImages ? scheme.Id : scheme.Id + TextOnlySuffix;
    }

    public static bool TryParse(string? id, [NotNullWhen(true)] out TokenCountingScheme? scheme)
    {
        scheme = null;
        var normalized = Normalize(id);
        if (normalized == null)
        {
            return false;
        }

        if (normalized.EndsWith(TextOnlySuffix, StringComparison.Ordinal))
        {
            if (!TryParse(normalized[..^TextOnlySuffix.Length], out var withImages) || !withImages.CountsImages)
            {
                return false;
            }

            scheme = withImages with { Id = normalized, CountsImages = false };
            return true;
        }

        switch (normalized)
        {
            case O200kTile:
                scheme = new TokenCountingScheme(normalized, TextEncoding.O200kBase, new TileImageCost(DefaultTileBase, DefaultTilePerTile), IsEstimate: false);
                return true;
            case Cl100kTile:
                scheme = new TokenCountingScheme(normalized, TextEncoding.Cl100kBase, new TileImageCost(DefaultTileBase, DefaultTilePerTile), IsEstimate: false);
                return true;
            case AnthropicEstimate:
                scheme = new TokenCountingScheme(normalized, TextEncoding.CharEstimate, new AreaImageCost(EstimatePixelsPerToken), IsEstimate: true, CharsPerToken: AnthropicCharsPerToken);
                return true;
            case WordCount:
                scheme = new TokenCountingScheme(normalized, TextEncoding.WordCount, new AreaImageCost(EstimatePixelsPerToken), IsEstimate: true);
                return true;
        }

        if (normalized.StartsWith(CharEstimatePrefix, StringComparison.Ordinal) &&
            double.TryParse(normalized[CharEstimatePrefix.Length..], NumberStyles.Float, CultureInfo.InvariantCulture, out var charsPerToken) &&
            charsPerToken > 0 && charsPerToken <= MaxCharsPerToken)
        {
            scheme = new TokenCountingScheme(normalized, TextEncoding.CharEstimate, new AreaImageCost(EstimatePixelsPerToken), IsEstimate: true, CharsPerToken: charsPerToken);
            return true;
        }

        if (normalized.StartsWith(O200kTilePrefix, StringComparison.Ordinal) &&
            TryParseTile(normalized[O200kTilePrefix.Length..], out var o200kTile))
        {
            scheme = new TokenCountingScheme(normalized, TextEncoding.O200kBase, o200kTile, IsEstimate: false);
            return true;
        }

        if (normalized.StartsWith(Cl100kTilePrefix, StringComparison.Ordinal) &&
            TryParseTile(normalized[Cl100kTilePrefix.Length..], out var cl100kTile))
        {
            scheme = new TokenCountingScheme(normalized, TextEncoding.Cl100kBase, cl100kTile, IsEstimate: false);
            return true;
        }

        if (normalized.StartsWith(O200kPatchPrefix, StringComparison.Ordinal) &&
            double.TryParse(normalized[O200kPatchPrefix.Length..], NumberStyles.Float, CultureInfo.InvariantCulture, out var multiplier) &&
            multiplier > 0 && multiplier <= 10)
        {
            scheme = new TokenCountingScheme(normalized, TextEncoding.O200kBase, new PatchImageCost(multiplier), IsEstimate: false);
            return true;
        }

        return false;
    }

    // "{base}-{perTile}", both positive integers.
    private static bool TryParseTile(string suffix, [NotNullWhen(true)] out TileImageCost? cost)
    {
        cost = null;
        var parts = suffix.Split('-');
        if (parts.Length != 2 ||
            !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var baseTokens) ||
            !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var perTile) ||
            baseTokens < 0 || perTile <= 0)
        {
            return false;
        }

        cost = new TileImageCost(baseTokens, perTile);
        return true;
    }
}
