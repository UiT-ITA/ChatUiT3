namespace ChatUiT.Server.Services.TokenCounting;

/// <summary>
/// Image token formulas as published by the providers. Pure functions so they can be
/// checked against the documented examples, and so the client can mirror them exactly
/// for the draft being typed.
/// </summary>
public static class ImageTokenMath
{
    private const int PatchSize = 32;
    private const int MaxPatches = 1536;

    /// <summary>OpenAI tile pricing (detail: high). 2048x4096 at 85/170 → 1105.</summary>
    public static int TileTokens(int width, int height, int baseTokens, int tokensPerTile)
    {
        double w = Math.Max(1, width);
        double h = Math.Max(1, height);

        // Fit within 2048x2048, aspect preserved.
        var longest = Math.Max(w, h);
        if (longest > 2048)
        {
            var scale = 2048 / longest;
            w *= scale;
            h *= scale;
        }

        // Shortest side to 768, downscale only.
        var shortest = Math.Min(w, h);
        if (shortest > 768)
        {
            var scale = 768 / shortest;
            w *= scale;
            h *= scale;
        }

        var tiles = (int)Math.Ceiling(w / 512) * (int)Math.Ceiling(h / 512);
        return baseTokens + tokensPerTile * tiles;
    }

    /// <summary>OpenAI patch pricing (mini/nano models). 1800x2400 at x1.62 → 2352.</summary>
    public static int PatchTokens(int width, int height, double multiplier)
    {
        double w = Math.Max(1, width);
        double h = Math.Max(1, height);

        var patches = Math.Ceiling(w / PatchSize) * Math.Ceiling(h / PatchSize);

        if (patches > MaxPatches)
        {
            // Shrink so the patch count fits the budget, then snap to whole patches.
            var scale = Math.Sqrt(PatchSize * PatchSize * (double)MaxPatches / (w * h));
            var scaledW = w * scale;
            var scaledH = h * scale;
            scale *= Math.Min(
                Math.Floor(scaledW / PatchSize) / (scaledW / PatchSize),
                Math.Floor(scaledH / PatchSize) / (scaledH / PatchSize));
            scaledW = w * scale;
            scaledH = h * scale;
            patches = Math.Ceiling(scaledW / PatchSize) * Math.Ceiling(scaledH / PatchSize);
        }

        var tokens = Math.Min(patches, MaxPatches);
        return (int)Math.Round(tokens * multiplier, MidpointRounding.AwayFromZero);
    }

    /// <summary>Anthropic pricing: pixels / 750.</summary>
    public static int AreaTokens(int width, int height, int pixelsPerToken)
    {
        double w = Math.Max(1, width);
        double h = Math.Max(1, height);
        return (int)Math.Ceiling(w * h / pixelsPerToken);
    }

    public static int Tokens(int width, int height, ImageCostRule rule) => rule switch
    {
        TileImageCost tile => TileTokens(width, height, tile.BaseTokens, tile.TokensPerTile),
        PatchImageCost patch => PatchTokens(width, height, patch.Multiplier),
        AreaImageCost area => AreaTokens(width, height, area.PixelsPerToken),
        _ => throw new ArgumentOutOfRangeException(nameof(rule))
    };
}
