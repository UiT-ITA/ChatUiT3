using System.Text.Json;
using ChatUitReact.Server.Models;
using OpenAI.Chat;

namespace ChatUitReact.Server.Services
{
    public interface IToolService
    {
        Task<IEnumerable<ChatToolDto>> GetAvailableToolDtos();
        IEnumerable<OpenAI.Chat.ChatTool> GetAvailableTools();
        IEnumerable<OpenAI.Chat.ChatTool> GetToolsForChat(ChatSettings settings);
        Task<string> ExecuteToolCallAsync(string functionName, JsonElement arguments, ToolContext context, CancellationToken cancellationToken = default);
        OpenAI.Chat.ChatTool ConvertToAzureOpenAITool(Models.ChatTool tool);
        ToolContext CreateToolContext(string userId, string chatId, string toolCallId);
    }
}
