using System.Text.Json;
using ChatUitReact.Server.Models;
using OpenAI.Chat;

namespace ChatUitReact.Server.Services
{
    public class ToolService : IToolService
    {
        public IEnumerable<OpenAI.Chat.ChatTool> GetAvailableTools()
        {
            return ToolCatalog.All.Select(ConvertToAzureOpenAITool);
        }

        public IEnumerable<OpenAI.Chat.ChatTool> GetToolsForChat(ChatSettings settings)
        {
            return GetAvailableTools();
        }

        public async Task<string> ExecuteToolCallAsync(string functionName, JsonElement arguments, ToolContext context, CancellationToken cancellationToken = default)
        {
            var tool = ToolCatalog.GetByFunctionName(functionName);
            if (tool == null)
            {
                return """{"error":"Tool not found"}""";
            }

            try
            {
                return await tool.ExecuteAsync(arguments, context, cancellationToken);
            }
            catch (Exception ex)
            {
                return $$"""{"error":"Tool execution failed: {{ex.Message}}"}""";
            }
        }

        public OpenAI.Chat.ChatTool ConvertToAzureOpenAITool(Models.ChatTool tool)
        {
            var parametersJson = BuildParametersJson(tool);
            return OpenAI.Chat.ChatTool.CreateFunctionTool(
                functionName: tool.FunctionName,
                functionDescription: tool.Description,
                functionParameters: BinaryData.FromString(parametersJson)
            );
        }

        public ToolContext CreateToolContext(string userId, string chatId, string toolCallId)
        {
            return new ToolContext
            {
                UserId = userId,
                ChatId = chatId,
                ToolCallId = toolCallId
            };
        }

        private string BuildParametersJson(Models.ChatTool tool)
        {
            var properties = new Dictionary<string, object>();
            
            foreach (var param in tool.Parameters)
            {
                var property = new Dictionary<string, object>
                {
                    ["type"] = param.Type,
                    ["description"] = param.Description
                };

                if (param.Enum != null && param.Enum.Length > 0)
                {
                    property["enum"] = param.Enum;
                }

                properties[param.Name] = property;
            }

            var schema = new
            {
                type = "object",
                properties = properties,
                required = tool.RequiredParameters.ToArray()
            };

            return JsonSerializer.Serialize(schema);
        }
    }
}
