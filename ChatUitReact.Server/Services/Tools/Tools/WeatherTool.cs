
using System.Text.Json;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;


public class WeatherTool : ChatTool
{
  public override string Name => "Get Weather";
  public override string Description => "Get the current weather for a specified location.";
  public override string FunctionName => "get_weather";
  public override List<ChatToolParameter> Parameters => new List<ChatToolParameter>
  {
    new ChatToolParameter
    {
      Name = "location",
      Type = "string",
      Description = "The location to get the weather for (e.g., city name or coordinates)."
    },
    new ChatToolParameter
    {
      Name = "units",
      Type = "string",
      Enum = new[] { "metric", "imperial" },
      Description = "The unit system to use (metric or imperial). Default is metric."
    }
  };
  public override List<string> RequiredParameters => new List<string> { "location" };
  public override async Task<string> ExecuteAsync(JsonElement args, ToolContext ctx, CancellationToken ct)
  {
    Console.WriteLine($"Executing WeatherTool with args: {args}");
    if (!args.TryGetProperty("location", out var loc) || loc.ValueKind != JsonValueKind.String)
      return """{"error":"Missing required argument: location"}""";

    var units = args.TryGetProperty("units", out var u) && u.ValueKind == JsonValueKind.String
        ? u.GetString() ?? "metric" : "metric";

    await Task.Delay(1000, ct); // Simulate async work
    return $$"""{"location":"{{loc.GetString()}}","temperature":"31","units":"{{units}}"}""";
  }
}