
using System.Text.Json;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services;

public static class ToolCatalog
{
  public static readonly ChatTool[] Tools =
  [
    new WeatherTool()
  ];

  private static readonly IReadOnlyDictionary<string, ChatTool> ByFunctionName =
    Tools.ToDictionary(t => t.FunctionName, StringComparer.OrdinalIgnoreCase);

  public static IEnumerable<ChatTool> All => Tools;

  public static ChatTool? GetByFunctionName(string functionName) =>
    ByFunctionName.TryGetValue(functionName, out var tool) ? tool : null;
}

