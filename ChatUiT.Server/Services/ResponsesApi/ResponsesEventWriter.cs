using System;
using System.Net.ServerSentEvents;
using System.Text.Json;
using System.Threading.Channels;

namespace ChatUiT.Server.Services.ResponsesApi;

/// <summary>
/// Builds the response object and, when streaming, the SSE events that describe it, in the
/// Responses API's sequence. Every event carries <c>type</c> and a <c>sequence_number</c> and is
/// serialised at the moment it is written, so later changes to an item do not alter it.
/// Without a channel only the object is built, for <c>stream: false</c>.
/// </summary>
public sealed class ResponsesEventWriter
{
    private readonly ChannelWriter<SseItem<string>>? _events;
    private int _sequence;

    public ResponsesEventWriter(ResponseObject response, ChannelWriter<SseItem<string>>? events)
    {
        Response = response;
        _events = events;
    }

    public ResponseObject Response { get; }

    public void Created()
    {
        Send("response.created", sequence => new { type = "response.created", sequence_number = sequence, response = Response });
        Send("response.in_progress", sequence => new { type = "response.in_progress", sequence_number = sequence, response = Response });
    }

    /// <summary>Appends the item to the output and announces it. Returns its output index.</summary>
    public int AddItem(ResponseItem item)
    {
        Response.Output.Add(item);
        var index = Response.Output.Count - 1;
        Send("response.output_item.added", sequence => new { type = "response.output_item.added", sequence_number = sequence, output_index = index, item });
        return index;
    }

    public void ItemDone(int index)
    {
        var item = Response.Output[index];
        Send("response.output_item.done", sequence => new { type = "response.output_item.done", sequence_number = sequence, output_index = index, item });
    }

    public void ContentPartAdded(int index)
    {
        var id = Response.Output[index].Id;
        Send("response.content_part.added", sequence => new { type = "response.content_part.added", sequence_number = sequence, item_id = id, output_index = index, content_index = 0, part = new OutputTextPart() });
    }

    public void OutputTextDelta(int index, string delta)
    {
        var id = Response.Output[index].Id;
        Send("response.output_text.delta", sequence => new { type = "response.output_text.delta", sequence_number = sequence, item_id = id, output_index = index, content_index = 0, delta, logprobs = Array.Empty<object>() });
    }

    public void OutputTextDone(int index, string text)
    {
        var id = Response.Output[index].Id;
        Send("response.output_text.done", sequence => new { type = "response.output_text.done", sequence_number = sequence, item_id = id, output_index = index, content_index = 0, text, logprobs = Array.Empty<object>() });
        Send("response.content_part.done", sequence => new { type = "response.content_part.done", sequence_number = sequence, item_id = id, output_index = index, content_index = 0, part = new OutputTextPart { Text = text } });
    }

    public void SummaryPartAdded(int index, int summaryIndex)
    {
        var id = Response.Output[index].Id;
        Send("response.reasoning_summary_part.added", sequence => new { type = "response.reasoning_summary_part.added", sequence_number = sequence, item_id = id, output_index = index, summary_index = summaryIndex, part = new SummaryText() });
    }

    public void SummaryTextDelta(int index, int summaryIndex, string delta)
    {
        var id = Response.Output[index].Id;
        Send("response.reasoning_summary_text.delta", sequence => new { type = "response.reasoning_summary_text.delta", sequence_number = sequence, item_id = id, output_index = index, summary_index = summaryIndex, delta });
    }

    public void SummaryPartDone(int index, int summaryIndex, string text)
    {
        var id = Response.Output[index].Id;
        Send("response.reasoning_summary_text.done", sequence => new { type = "response.reasoning_summary_text.done", sequence_number = sequence, item_id = id, output_index = index, summary_index = summaryIndex, text });
        Send("response.reasoning_summary_part.done", sequence => new { type = "response.reasoning_summary_part.done", sequence_number = sequence, item_id = id, output_index = index, summary_index = summaryIndex, part = new SummaryText { Text = text } });
    }

    public void FunctionCallArguments(int index, string arguments, string name)
    {
        var id = Response.Output[index].Id;
        Send("response.function_call_arguments.delta", sequence => new { type = "response.function_call_arguments.delta", sequence_number = sequence, item_id = id, output_index = index, delta = arguments });
        Send("response.function_call_arguments.done", sequence => new { type = "response.function_call_arguments.done", sequence_number = sequence, item_id = id, output_index = index, name, arguments });
    }

    public void McpCallInProgress(int index) => SendMcpCall("response.mcp_call.in_progress", index);

    /// <summary>ChatUiT extension: a server tool that is an agent called one of its functions. Progress only, names only.</summary>
    public void McpCallInnerCall(int index, string name)
    {
        var id = Response.Output[index].Id;
        Send("response.chatuit_mcp_call.inner_call", sequence => new { type = "response.chatuit_mcp_call.inner_call", sequence_number = sequence, output_index = index, item_id = id, name });
    }

    /// <summary>ChatUiT extension: a new part of the inner agent's reasoning summary starts. Progress only.</summary>
    public void McpCallSummaryPartAdded(int index, int summaryIndex)
    {
        var id = Response.Output[index].Id;
        Send("response.chatuit_mcp_call.reasoning_summary_part.added", sequence => new { type = "response.chatuit_mcp_call.reasoning_summary_part.added", sequence_number = sequence, output_index = index, item_id = id, summary_index = summaryIndex });
    }

    /// <summary>ChatUiT extension: a fragment of the inner agent's current reasoning summary part. Progress only.</summary>
    public void McpCallSummaryTextDelta(int index, int summaryIndex, string delta)
    {
        var id = Response.Output[index].Id;
        Send("response.chatuit_mcp_call.reasoning_summary_text.delta", sequence => new { type = "response.chatuit_mcp_call.reasoning_summary_text.delta", sequence_number = sequence, output_index = index, item_id = id, summary_index = summaryIndex, delta });
    }

    public void McpCallCompleted(int index) => SendMcpCall("response.mcp_call.completed", index);

    public void McpCallFailed(int index) => SendMcpCall("response.mcp_call.failed", index);

    public void Completed()
    {
        Response.Status = "completed";
        Send("response.completed", sequence => new { type = "response.completed", sequence_number = sequence, response = Response });
    }

    /// <summary>Ends the response as failed: an <c>error</c> event, then <c>response.failed</c>.</summary>
    public void Failed(string message)
    {
        Response.Status = "failed";
        Response.Error = new ResponseError { Code = "server_error", Message = message };
        Send("error", sequence => new { type = "error", sequence_number = sequence, code = "server_error", message, param = (string?)null });
        Send("response.failed", sequence => new { type = "response.failed", sequence_number = sequence, response = Response });
    }

    private void SendMcpCall(string type, int index)
    {
        var id = Response.Output[index].Id;
        Send(type, sequence => new { type, sequence_number = sequence, item_id = id, output_index = index });
    }

    private void Send<T>(string type, Func<int, T> build)
    {
        if (_events == null)
        {
            return;
        }

        var json = JsonSerializer.Serialize(build(_sequence++), ResponsesJson.Options);
        _events.TryWrite(new SseItem<string>(json, type));
    }
}
