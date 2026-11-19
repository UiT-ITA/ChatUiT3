using System.ClientModel;
using System.ClientModel.Primitives;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Anthropic;
using Anthropic.Models.Messages;
using ChatUiT.Server.Errors;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Telemetry;
using OpenAI;
using OpenAI.Chat;

namespace ChatUiT.Server.Tests;

/// <summary>Checks the error codes of provider failures, from exceptions the SDKs throw for fake responses.</summary>
public class ProviderErrorsTests
{
    public static TheoryData<int, string, string> OpenAiResponses => new()
    {
        { 400, """{"error":{"message":"Exceeded maximum number of images (50) allowed in the request.","type":"invalid_request_error","param":null,"code":"BadRequest"}}""", "E2100" },
        { 400, """{"error":{"message":"You uploaded an unsupported image. Please make sure your image is valid.","type":"invalid_request_error","param":null,"code":"image_parse_error"}}""", "E2101" },
        { 400, """{"error":{"message":"Invalid image data","type":"invalid_request_error","param":null,"code":"BadRequest"}}""", "E2101" },
        { 400, """{"error":{"message":"Your input exceeds the context window of this model. Please adjust your input and try again.","type":"invalid_request_error","param":"input","code":"context_length_exceeded"}}""", "E2102" },
        { 400, """{"error":{"message":"This model's maximum context length is 128000 tokens. However, your messages resulted in 130000 tokens.","type":"invalid_request_error","param":"messages","code":null}}""", "E2102" },
        { 400, """{"error":{"message":"The response was filtered due to the prompt triggering Azure OpenAI's content management policy.","type":null,"param":"prompt","code":"content_filter","status":400,"innererror":{"code":"ResponsibleAIPolicyViolation","content_filter_result":{"hate":{"filtered":true,"severity":"high"}}}}}""", "E2104" },
        { 400, """{"error":{"message":"Invalid prompt: your prompt was flagged as potentially violating our usage policy.","type":"invalid_request_error","param":null,"code":"invalid_prompt"}}""", "E2104" },
        { 429, """{"error":{"code":"429","message":"Requests to the ChatCompletions_Create Operation have exceeded token rate limit of your current OpenAI S0 pricing tier. Please retry after 6 seconds."}}""", "E2107" },
        { 429, """{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","param":null,"code":"insufficient_quota"}}""", "E2108" },
        { 401, """{"error":{"code":"401","message":"Access denied due to invalid subscription key or wrong API endpoint."}}""", "E2109" },
        { 401, """{"error":{"message":"Incorrect API key provided.","type":"invalid_request_error","param":null,"code":"invalid_api_key"}}""", "E2109" },
        { 403, "", "E2109" },
        { 404, """{"error":{"code":"DeploymentNotFound","message":"The API deployment for this resource does not exist."}}""", "E2110" },
        { 404, """{"error":{"message":"The model `gpt-x` does not exist or you do not have access to it.","type":"invalid_request_error","param":null,"code":"model_not_found"}}""", "E2110" },
        { 413, "", "E2111" },
        { 400, """{"error":{"message":"Invalid schema for function 'search': In context=(), 'additionalProperties' is required to be supplied and to be false.","type":"invalid_request_error","param":"tools[0].function.parameters","code":"invalid_function_parameters"}}""", "E2112" },
        { 400, """{"error":{"message":"Invalid 'tools[0].function.name': string does not match pattern.","type":"invalid_request_error","param":"tools[0].function.name","code":"invalid_value"}}""", "E2112" },
        { 500, """{"error":{"message":"The server had an error while processing your request.","type":"server_error","param":null,"code":null}}""", "E2113" },
        { 503, "", "E2113" },
        { 504, "", "E2114" },
        { 400, """{"error":{"message":"Unrecognized request argument supplied: foo","type":"invalid_request_error","param":null,"code":null}}""", "E2198" },
        { 418, "not json", "E2198" }
    };

    [Theory]
    [MemberData(nameof(OpenAiResponses))]
    public async Task OpenAi_error_responses_get_their_code(int status, string body, string expected)
    {
        var exception = await OpenAiFailure(new Respond((HttpStatusCode)status, body, "application/json"));

        Assert.IsType<ClientResultException>(exception);
        Assert.Equal(expected, ProviderErrors.Classify(exception)?.Code);
    }

    public static TheoryData<int, string, string> AnthropicResponses => new()
    {
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"Too much media: 0 document pages + 102 images > 100"}}""", "E2100" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"too many images and documents: 104 + 1 > 100"}}""", "E2100" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"messages.0.content.1.image.source.base64: image exceeds 5 MB maximum: 6000000 bytes > 5242880 bytes"}}""", "E2101" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"At least one of the image dimensions exceed max allowed size for many-image requests: 2000 pixels"}}""", "E2101" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 210000 tokens > 200000 maximum"}}""", "E2102" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"input length and `max_tokens` exceed context limit: 190000 + 20000 > 200000"}}""", "E2102" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}""", "E2108" },
        { 402, """{"type":"error","error":{"type":"billing_error","message":"There is an issue with your billing."}}""", "E2108" },
        { 429, """{"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}""", "E2107" },
        { 401, """{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}""", "E2109" },
        { 403, """{"type":"error","error":{"type":"permission_error","message":"Your API key does not have permission to use the specified resource."}}""", "E2109" },
        { 404, """{"type":"error","error":{"type":"not_found_error","message":"model: claude-x"}}""", "E2110" },
        { 413, """{"type":"error","error":{"type":"request_too_large","message":"Request exceeds the maximum allowed number of bytes."}}""", "E2111" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"tools.0.custom.input_schema: JSON schema is invalid. It must match JSON Schema draft 2020-12"}}""", "E2112" },
        { 529, """{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}""", "E2113" },
        { 500, """{"type":"error","error":{"type":"api_error","message":"Internal server error"}}""", "E2113" },
        { 504, """{"type":"error","error":{"type":"timeout_error","message":"Request timeout"}}""", "E2114" },
        { 400, """{"type":"error","error":{"type":"invalid_request_error","message":"messages: roles must alternate"}}""", "E2198" }
    };

    [Theory]
    [MemberData(nameof(AnthropicResponses))]
    public async Task Anthropic_error_responses_get_their_code(int status, string body, string expected)
    {
        var exception = await AnthropicFailure(new Respond((HttpStatusCode)status, body, "application/json"));

        Assert.StartsWith("Anthropic", exception.GetType().Name);
        Assert.Equal(expected, ProviderErrors.Classify(exception)?.Code);
    }

    [Theory]
    [InlineData("overloaded_error", "Overloaded", "E2113")]
    [InlineData("api_error", "Internal server error", "E2113")]
    [InlineData("invalid_request_error", "something else", "E2199")]
    public async Task Anthropic_stream_errors_get_their_code(string type, string message, string expected)
    {
        var stream =
            "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"m\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"c\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":1,\"output_tokens\":1}}}\n\n"
            + $"event: error\ndata: {{\"type\":\"error\",\"error\":{{\"type\":\"{type}\",\"message\":\"{message}\"}}}}\n\n";

        var exception = await AnthropicFailure(new Respond(HttpStatusCode.OK, stream, "text/event-stream"));

        Assert.Equal("AnthropicSseException", exception.GetType().Name);
        Assert.Equal(expected, ProviderErrors.Classify(exception)?.Code);
    }

    [Fact]
    public async Task Connection_failures_get_their_code()
    {
        var connect = () => new HttpRequestException(HttpRequestError.ConnectionError, "refused");

        Assert.Equal("E2115", ProviderErrors.Classify(await OpenAiFailure(new Fail(connect)))?.Code);
        Assert.Equal("E2115", ProviderErrors.Classify(await AnthropicFailure(new Fail(connect)))?.Code);
    }

    [Fact]
    public void Transport_failures_outside_a_provider_call_are_not_provider_failures()
    {
        Assert.Null(ProviderErrors.Classify(Thrown(new HttpRequestException("refused", new SocketException()))));
        Assert.Null(ProviderErrors.Classify(Thrown(new HttpIOException(HttpRequestError.ResponseEnded))));
        Assert.Null(ProviderErrors.Classify(Thrown(new TimeoutException())));
        Assert.Null(ProviderErrors.Classify(Thrown(new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout"))));
    }

    private static Exception Thrown(Exception exception)
    {
        try
        {
            throw exception;
        }
        catch (Exception caught)
        {
            return caught;
        }
    }

    [Fact]
    public async Task Timeouts_get_their_code()
    {
        Assert.Equal("E2114", ProviderErrors.Classify(await OpenAiFailure(new Fail(null), TimeSpan.FromMilliseconds(100)))?.Code);
        Assert.Equal("E2114", ProviderErrors.Classify(await AnthropicFailure(new Fail(null), TimeSpan.FromMilliseconds(100)))?.Code);
    }

    [Theory]
    [InlineData("max_output_tokens", "E2103")]
    [InlineData("content_filter", "E2105")]
    [InlineData("unknown", "E2199")]
    public void Incomplete_reasons_get_their_code(string reason, string expected)
        => Assert.Equal(expected, ProviderErrors.FromIncompleteReason(reason).Code);

    [Theory]
    [InlineData("content_filter", "filtered", "E2105")]
    [InlineData("context_length_exceeded", "too long", "E2102")]
    [InlineData("rate_limit_exceeded", "slow down", "E2107")]
    [InlineData("server_error", "oops", "E2113")]
    [InlineData("invalid_image", "bad", "E2101")]
    [InlineData(null, null, "E2199")]
    public void Stream_errors_get_their_code(string? code, string? message, string expected)
        => Assert.Equal(expected, ProviderErrors.FromStreamError(code, message).Code);

    [Fact]
    public void Turn_failures_carry_their_code_and_its_message()
    {
        var exception = new AiTurnFailedException(ErrorCodes.ProviderRefused, ErrorCategories.ProviderRefused, "cyber");

        Assert.Same(ErrorCodes.ProviderRefused, ProviderErrors.Classify(exception));
        Assert.Equal(ErrorCodes.ProviderRefused.Message, exception.Message);
    }

    [Fact]
    public void Other_exceptions_are_not_provider_failures()
    {
        Assert.Null(ProviderErrors.Classify(new InvalidOperationException("x")));
        Assert.Null(ProviderErrors.Classify(new OperationCanceledException()));
    }

    [Fact]
    public void Provider_codes_are_unique()
    {
        var codes = typeof(ErrorCodes).GetFields()
            .Select(field => field.GetValue(null))
            .OfType<ErrorCode>()
            .Where(code => int.TryParse(code.Code[1..], out var number) && number is >= 2100 and <= 2299)
            .ToList();

        Assert.Equal(18, codes.Count);
        Assert.Equal(codes.Count, codes.Select(code => code.Code).Distinct().Count());
    }

    private static async Task<Exception> OpenAiFailure(HttpMessageHandler handler, TimeSpan? timeout = null)
    {
        var options = new OpenAIClientOptions
        {
            Endpoint = new Uri("http://localhost/v1"),
            Transport = new HttpClientPipelineTransport(new HttpClient(handler)),
            RetryPolicy = new ClientRetryPolicy(0)
        };
        if (timeout != null)
        {
            options.NetworkTimeout = timeout;
        }

        var client = new ChatClient("model", new ApiKeyCredential("test"), options);
        return await Assert.ThrowsAnyAsync<Exception>(async () =>
        {
            await foreach (var _ in client.CompleteChatStreamingAsync([new UserChatMessage("hi")]))
            {
            }
        });
    }

    private static async Task<Exception> AnthropicFailure(HttpMessageHandler handler, TimeSpan? timeout = null)
    {
        var client = new AnthropicClient { ApiKey = "test", HttpClient = new HttpClient(handler), MaxRetries = 0, Timeout = timeout };
        var parameters = new MessageCreateParams
        {
            Model = "model",
            MaxTokens = 10,
            Messages = [new MessageParam { Role = Role.User, Content = "hi" }]
        };
        return await Assert.ThrowsAnyAsync<Exception>(async () =>
        {
            await foreach (var _ in client.Messages.CreateStreaming(parameters))
            {
            }
        });
    }

    /// <summary>Answers every request with a fixed status and body.</summary>
    private sealed class Respond(HttpStatusCode status, string body, string contentType) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, contentType) });
    }

    /// <summary>Throws the exception, or waits until cancelled when there is none.</summary>
    private sealed class Fail(Func<Exception>? exception) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (exception == null)
            {
                await Task.Delay(Timeout.Infinite, cancellationToken);
            }

            throw exception!();
        }
    }
}
