using System.Text.Json;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services
{
    /// <summary>
    /// The tool catalog and execution. Provider-neutral by design: converting a tool into a
    /// particular SDK's shape belongs to that provider, so nothing here exposes OpenAI or
    /// Anthropic types.
    /// </summary>
    public interface IToolService
    {
        Task<IEnumerable<ChatToolDto>> GetAvailableToolDtos();

        /// <summary>
        /// The tool definitions for a request. Takes already-resolved ids rather than
        /// ChatSettings so capability gating (a model that cannot call tools yields an empty
        /// list) happens in one place instead of being re-derived here.
        /// </summary>
        IEnumerable<ChatTool> GetToolDefinitions(IEnumerable<string> toolIds);

        Task<string> ExecuteToolCallAsync(string functionName, JsonElement arguments, ToolContext context, CancellationToken cancellationToken = default);

        ToolContext CreateToolContext(string userId, string chatId, string toolCallId);
    }
}
