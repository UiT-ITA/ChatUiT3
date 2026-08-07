using System.Net;
using System.Net.Sockets;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;
using Microsoft.Extensions.Logging.Abstractions;
using DomainModel = ChatUitReact.Server.Models.Model;

namespace ChatUitReact.Server.Tests;

/// <summary>
/// The provider used to cache one client per endpoint id, so editing an endpoint's URL or key
/// in the admin panel did nothing until the server was restarted — and the restart made the
/// change look like it had never worked. These drive the real SDK against a local listener, so
/// they check the request that actually goes out.
/// </summary>
public class AnthropicEndpointTests
{
    [Fact]
    public async Task EditingAnEndpointsUrl_TakesEffectWithoutRestartingTheServer()
    {
        // One provider instance and one endpoint id — only the row's URL changed, exactly as
        // it does when an admin saves the endpoint form.
        using var oldServer = new CapturingServer();
        using var newServer = new CapturingServer();
        var provider = NewProvider();

        await SendAsync(provider, Endpoint($"{oldServer.BaseUrl}/anthropic"));
        await SendAsync(provider, Endpoint($"{newServer.BaseUrl}/anthropic"));

        Assert.Single(oldServer.Paths);
        Assert.Single(newServer.Paths);
    }

    [Fact]
    public async Task RotatingAnEndpointsApiKey_TakesEffectWithoutRestartingTheServer()
    {
        using var server = new CapturingServer();
        var provider = NewProvider();

        await SendAsync(provider, Endpoint($"{server.BaseUrl}/anthropic", apiKey: "old-key"));
        await SendAsync(provider, Endpoint($"{server.BaseUrl}/anthropic", apiKey: "new-key"));

        Assert.Equal(new[] { "old-key", "new-key" }, server.ApiKeys);
    }

    [Fact]
    public async Task TheBaseUrl_HasV1MessagesAppendedToIt()
    {
        // Why the admin form tells you to leave /v1 off: the SDK adds it. A URL ending in /v1
        // would produce /anthropic/v1/v1/messages and a 404.
        using var server = new CapturingServer();

        await SendAsync(NewProvider(), Endpoint($"{server.BaseUrl}/anthropic"));

        Assert.Equal("/anthropic/v1/messages", server.Paths.Single());
    }

    private static AnthropicProvider NewProvider() => new(NullLogger<AnthropicProvider>.Instance);

    /// <summary>Always the same id — an edit changes the row, not its identity.</summary>
    private static ModelEndpoint Endpoint(string url, string apiKey = "test-key") => new()
    {
        Id = "the-one-endpoint",
        Url = url,
        ApiKey = apiKey,
        EndpointType = EndpointType.Anthropic
    };

    /// <summary>
    /// Runs one streamed turn. The server answers 400, which the SDK does not retry, so the
    /// call fails fast and the request it produced is what we assert on.
    /// </summary>
    private static async Task SendAsync(AnthropicProvider provider, ModelEndpoint endpoint)
    {
        var conversation = provider.StartConversation(new AiRequest
        {
            Model = new DomainModel { ModelId = "claude-opus-5" },
            Endpoint = endpoint,
            Messages = new List<ChatMessage> { new() { Role = AiChatRole.User, Content = "hi" } },
            Parameters = new ResolvedChatParameters { MaxOutputTokens = 1024 }
        });

        try
        {
            await foreach (var _ in conversation.StreamTurnAsync())
            {
            }
        }
        catch (Exception)
        {
            // The rejection is expected; the request it produced is the point.
        }
    }

    /// <summary>Records every request it receives and rejects it with a 400.</summary>
    private sealed class CapturingServer : IDisposable
    {
        private readonly HttpListener _listener = new();
        private readonly List<(string Path, string? ApiKey)> _requests = new();
        private readonly Lock _gate = new();

        public CapturingServer()
        {
            BaseUrl = $"http://localhost:{FreePort()}";
            _listener.Prefixes.Add($"{BaseUrl}/");
            _listener.Start();
            _ = Task.Run(ListenAsync);
        }

        public string BaseUrl { get; }

        public IReadOnlyList<string> Paths => Snapshot().Select(r => r.Path).ToList();

        public IReadOnlyList<string?> ApiKeys => Snapshot().Select(r => r.ApiKey).ToList();

        private List<(string Path, string? ApiKey)> Snapshot()
        {
            lock (_gate)
            {
                return _requests.ToList();
            }
        }

        private async Task ListenAsync()
        {
            while (_listener.IsListening)
            {
                HttpListenerContext context;
                try
                {
                    context = await _listener.GetContextAsync();
                }
                catch
                {
                    return;
                }

                lock (_gate)
                {
                    _requests.Add((context.Request.Url!.AbsolutePath, context.Request.Headers["x-api-key"]));
                }

                var body = "{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"stub\"}}"u8;
                context.Response.StatusCode = 400;
                context.Response.ContentType = "application/json";
                await context.Response.OutputStream.WriteAsync(body.ToArray());
                context.Response.Close();
            }
        }

        private static int FreePort()
        {
            var probe = new TcpListener(IPAddress.Loopback, 0);
            probe.Start();
            var port = ((IPEndPoint)probe.LocalEndpoint).Port;
            probe.Stop();
            return port;
        }

        public void Dispose() => _listener.Close();
    }
}
