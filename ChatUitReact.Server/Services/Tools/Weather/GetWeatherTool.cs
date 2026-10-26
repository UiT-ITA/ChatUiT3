using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

public enum WeatherUnits
{
    Metric,
    Imperial
}

public sealed record GetWeatherArgs(
    [property: Description("The location to get the weather for, as a city name or coordinates.")]
    string Location,
    [property: Description("The unit system. Defaults to metric.")]
    WeatherUnits? Units);

/// <summary>Placeholder tool kept for exercising the tool loop. Returns a fixed reading.</summary>
public sealed class GetWeatherTool : Tool<GetWeatherArgs>
{
    public override string Id => "get_weather";

    public override string DisplayName => "Get Weather";
    public override DataClassification Classification => DataClassification.Red;

    public override string Description => "Get the current weather for a specified location.";

    public override IReadOnlyList<string> LegacyIds => ["weather_tool"];

    protected override async Task<ToolResult> ExecuteAsync(GetWeatherArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(args.Location))
        {
            return ToolResult.Error("Missing required argument: location");
        }

        await Task.Delay(1000, cancellationToken);
        var units = (args.Units ?? WeatherUnits.Metric).ToString().ToLowerInvariant();
        return ToolResult.Ok(new { location = args.Location, temperature = "31", units });
    }
}
