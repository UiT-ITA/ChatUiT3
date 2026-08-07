using System.Text.Json;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Services.AiProviders;
using Microsoft.Extensions.Logging.Abstractions;

namespace ChatUitReact.Server.Tests;

/// <summary>
/// Covers the loop the providers no longer own: multiple tool rounds, the round cap, tool
/// failures, and the marker format the client parser depends on.
/// </summary>
public class AiConversationRunnerTests
{
    [Fact]
    public async Task PlainTurn_StreamsTextAndCompletes()
    {
        var provider = new FakeProvider(new[]
        {
            Turn.Text("Hello ", "world")
        });

        var chunks = await RunAsync(provider);

        Assert.Equal("Hello world", Text(chunks));
        Assert.True(chunks[^1].IsComplete);
    }

    [Fact]
    public async Task ToolCall_IsExecutedAndTheConversationContinues()
    {
        var provider = new FakeProvider(new[]
        {
            Turn.Tool("call-1", "get_weather", """{"city":"Tromso"}"""),
            Turn.Text("It is cold.")
        });
        var tools = new FakeToolService("12 degrees");

        var chunks = await RunAsync(provider, tools);
        var text = Text(chunks);

        // The marker format the client's toolCallParser depends on.
        Assert.Contains("<ToolCall>\nget_weather({\"city\":\"Tromso\"})", text);
        Assert.Contains("12 degrees", text);
        Assert.Contains("</ToolCall>", text);
        Assert.EndsWith("It is cold.", text);

        // The result must reach the provider, or the model answers without it.
        Assert.Equal(new[] { "call-1" }, provider.ReceivedResults.Select(r => r.ToolCallId));
        Assert.Equal("get_weather", tools.Executed.Single());
    }

    [Fact]
    public async Task ToolCallsAcrossMultipleRounds_AreAllExecuted()
    {
        // The previous implementation handled exactly one round and silently dropped any
        // tool call the continuation made.
        var provider = new FakeProvider(new[]
        {
            Turn.Tool("call-1", "first", "{}"),
            Turn.Tool("call-2", "second", "{}"),
            Turn.Text("Done.")
        });
        var tools = new FakeToolService("ok");

        var chunks = await RunAsync(provider, tools);

        Assert.Equal(new[] { "first", "second" }, tools.Executed);
        Assert.EndsWith("Done.", Text(chunks));
    }

    [Fact]
    public async Task AModelThatOnlyEverCallsTools_StopsAtTheRoundCap()
    {
        // Never yields a text-only turn, so without a cap this would run forever.
        var provider = new FakeProvider(Enumerable.Range(0, 100)
            .Select(i => Turn.Tool($"call-{i}", "loop", "{}"))
            .ToArray());
        var tools = new FakeToolService("ok");

        var chunks = await RunAsync(provider, tools);

        Assert.True(tools.Executed.Count < 100);
        Assert.Contains("Stopped after too many tool calls", Text(chunks));
        Assert.True(chunks[^1].IsComplete);
    }

    [Fact]
    public async Task AFailingTool_ReportsTheErrorAndKeepsGoing()
    {
        var provider = new FakeProvider(new[]
        {
            Turn.Tool("call-1", "broken", "{}"),
            Turn.Text("I could not look that up.")
        });
        var tools = new FakeToolService(_ => throw new InvalidOperationException("boom"));

        var chunks = await RunAsync(provider, tools);

        Assert.Contains("Error: boom", Text(chunks));
        // The model is told the call failed so it can adapt rather than assume success.
        Assert.True(provider.ReceivedResults.Single().IsError);
        Assert.EndsWith("I could not look that up.", Text(chunks));
    }

    [Fact]
    public async Task AnUnregisteredEndpointType_Throws()
    {
        var registry = new AiProviderRegistry(new[] { new FakeProvider(Array.Empty<Turn>()) });

        Assert.Throws<NotSupportedException>(() => registry.For(EndpointType.Anthropic));
        Assert.False(registry.Supports(EndpointType.Anthropic));
        Assert.True(registry.Supports(EndpointType.AzureOpenAI));
    }

    private static async Task<List<ChatResponseChunk>> RunAsync(
        FakeProvider provider,
        FakeToolService? tools = null)
    {
        var runner = new AiConversationRunner(
            new AiProviderRegistry(new[] { provider }),
            tools ?? new FakeToolService("ok"),
            NullLogger<AiConversationRunner>.Instance);

        var request = new AiRequest
        {
            Model = new Model(),
            Endpoint = new ModelEndpoint { EndpointType = EndpointType.AzureOpenAI },
            Messages = new List<ChatMessage>(),
            Parameters = new ResolvedChatParameters { MaxOutputTokens = 1000 }
        };

        var chunks = new List<ChatResponseChunk>();
        await foreach (var chunk in runner.StreamAsync(request, "user", "chat"))
        {
            chunks.Add(chunk);
        }

        return chunks;
    }

    private static string Text(IEnumerable<ChatResponseChunk> chunks) =>
        string.Concat(chunks.Select(c => c.Content));

    private sealed record Turn(string[] Deltas, AiStreamEvent.ToolCall? ToolCall)
    {
        public static Turn Text(params string[] deltas) => new(deltas, null);

        public static Turn Tool(string id, string name, string args) =>
            new(Array.Empty<string>(), new AiStreamEvent.ToolCall(id, name, args));
    }

    private sealed class FakeProvider : IAiProvider, IAiConversation
    {
        private readonly Turn[] _turns;
        private int _turnIndex;

        public FakeProvider(Turn[] turns) => _turns = turns;

        public List<AiToolResult> ReceivedResults { get; } = new();

        public EndpointType EndpointType => EndpointType.AzureOpenAI;

        public IAiConversation StartConversation(AiRequest request) => this;

        public Task<string> CompleteTextAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult("name");

        public async IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(CancellationToken cancellationToken = default)
        {
            await Task.Yield();

            if (_turnIndex >= _turns.Length)
            {
                yield break;
            }

            var turn = _turns[_turnIndex++];

            foreach (var delta in turn.Deltas)
            {
                yield return new AiStreamEvent.Text(delta);
            }

            if (turn.ToolCall != null)
            {
                yield return turn.ToolCall;
            }
        }

        public void AppendToolResults(IReadOnlyList<AiToolResult> results) => ReceivedResults.AddRange(results);
    }

    private sealed class FakeToolService : IToolService
    {
        private readonly Func<string, string> _execute;

        public FakeToolService(string result) => _execute = _ => result;
        public FakeToolService(Func<string, string> execute) => _execute = execute;

        public List<string> Executed { get; } = new();

        public Task<string> ExecuteToolCallAsync(string functionName, JsonElement arguments, ToolContext context, CancellationToken cancellationToken = default)
        {
            Executed.Add(functionName);
            return Task.FromResult(_execute(functionName));
        }

        public ToolContext CreateToolContext(string userId, string chatId, string toolCallId) => new()
        {
            UserId = userId,
            ChatId = chatId,
            ToolCallId = toolCallId
        };

        public Task<IEnumerable<ChatToolDto>> GetAvailableToolDtos() =>
            Task.FromResult(Enumerable.Empty<ChatToolDto>());

        public IEnumerable<ChatTool> GetToolDefinitions(IEnumerable<string> toolIds) =>
            Enumerable.Empty<ChatTool>();
    }
}
