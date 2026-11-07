namespace ChatUiT.Server.Services.Insights;

/// <summary>The "Insights" configuration section.</summary>
public sealed class InsightsOptions
{
    public const string SectionName = "Insights";

    /// <summary>The Azure resource ID of the Application Insights resource the queries read.</summary>
    public string? ApplicationInsightsResourceId { get; set; }
}
