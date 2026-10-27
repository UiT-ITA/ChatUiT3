using System;

namespace ChatUiT.Server.Services.Tools;

/// <summary>Bound from the <c>Tools</c> configuration section.</summary>
public sealed class ToolOptions
{
    public const string SectionName = "Tools";

    /// <summary>Tool output longer than this is cut before it reaches the model. The user still sees all of it.</summary>
    public int MaxModelContentChars { get; set; } = 32_000;

    public TimeSpan ConfirmationTimeout { get; set; } = TimeSpan.FromMinutes(10);

    public TimeSpan ClientToolTimeout { get; set; } = TimeSpan.FromSeconds(60);

    public int MaxClientTools { get; set; } = 64;

    public int MaxClientSchemaBytes { get; set; } = 16_384;

    public int MaxClientSchemaDepth { get; set; } = 8;
}
