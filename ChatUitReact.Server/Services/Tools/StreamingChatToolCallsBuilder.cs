using OpenAI.Chat;
using System.Text.Json;

namespace ChatUitReact.Server.Services.Tools;

public class StreamingChatToolCallsBuilder
{
    private readonly Dictionary<int, string> _indexToToolCallId = [];
    private readonly Dictionary<int, string> _indexToFunctionName = [];
    private readonly Dictionary<int, string> _indexToFunctionArguments = [];

    public void Append(StreamingChatToolCallUpdate toolCallUpdate)
    {
        if (toolCallUpdate.ToolCallId != null)
        {
            _indexToToolCallId[toolCallUpdate.Index] = toolCallUpdate.ToolCallId;
        }

        if (toolCallUpdate.FunctionName != null)
        {
            _indexToFunctionName[toolCallUpdate.Index] = toolCallUpdate.FunctionName;
        }

        if (toolCallUpdate.FunctionArgumentsUpdate != null && !toolCallUpdate.FunctionArgumentsUpdate.ToMemory().IsEmpty)
        {
            if (!_indexToFunctionArguments.TryGetValue(toolCallUpdate.Index, out string? existingArgs))
            {
                existingArgs = string.Empty;
            }

            var newArgsText = System.Text.Encoding.UTF8.GetString(toolCallUpdate.FunctionArgumentsUpdate.ToMemory().Span);
            _indexToFunctionArguments[toolCallUpdate.Index] = existingArgs + newArgsText;
        }
    }

    public IReadOnlyList<ChatToolCall> Build()
    {
        var toolCalls = new List<ChatToolCall>();

        foreach ((int index, string toolCallId) in _indexToToolCallId)
        {
            var functionName = _indexToFunctionName[index];
            var functionArguments = _indexToFunctionArguments.GetValueOrDefault(index, "{}");

            var toolCall = ChatToolCall.CreateFunctionToolCall(
                id: toolCallId,
                functionName: functionName,
                functionArguments: BinaryData.FromString(functionArguments));

            toolCalls.Add(toolCall);
        }

        return toolCalls;
    }
}
