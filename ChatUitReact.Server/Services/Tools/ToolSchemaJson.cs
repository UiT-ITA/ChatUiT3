using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace ChatUitReact.Server.Services.Tools;

using ChatUitReact.Server.Models;

/// <summary>
/// Renders a tool's parameters as JSON Schema. Shared by every provider — OpenAI's
/// function parameters and Anthropic's tool input_schema both take the same shape, so the
/// schema is built once here rather than per adapter.
/// </summary>
public static class ToolSchemaJson
{
    public static string Build(ChatTool tool) => JsonSerializer.Serialize(BuildSchema(tool));

    public static Dictionary<string, object> BuildSchema(ChatTool tool)
    {
        var properties = new Dictionary<string, object>();

        foreach (var parameter in tool.Parameters)
        {
            var property = new Dictionary<string, object>
            {
                ["type"] = parameter.Type,
                ["description"] = parameter.Description
            };

            if (parameter.Enum != null && parameter.Enum.Length > 0)
            {
                property["enum"] = parameter.Enum;
            }

            properties[parameter.Name] = property;
        }

        return new Dictionary<string, object>
        {
            ["type"] = "object",
            ["properties"] = properties,
            ["required"] = tool.RequiredParameters.ToArray()
        };
    }
}
