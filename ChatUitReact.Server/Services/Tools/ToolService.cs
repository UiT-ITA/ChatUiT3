using System.Text.Json;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services
{
    public class ToolService : IToolService
    {
        public async Task<IEnumerable<ChatToolDto>> GetAvailableToolDtos()
        {
            await Task.CompletedTask;
            return ToolCatalog.All.Select(t => new ChatToolDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description
            });
        }

        public IEnumerable<ChatTool> GetToolDefinitions(IEnumerable<string> toolIds)
        {
            var ids = toolIds?.ToHashSet();
            if (ids == null || ids.Count == 0)
            {
                return Enumerable.Empty<ChatTool>();
            }

            return ToolCatalog.All.Where(tool => ids.Contains(tool.Id));
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

        public ToolContext CreateToolContext(string userId, string chatId, string toolCallId)
        {
            return new ToolContext
            {
                UserId = userId,
                ChatId = chatId,
                ToolCallId = toolCallId
            };
        }
    }
}
