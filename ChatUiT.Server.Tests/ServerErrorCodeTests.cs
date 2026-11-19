using System.Diagnostics;
using System.Net;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using ChatUiT.Server.Errors;
using ChatUiT.Server.Models;
using ChatUiT.Server.Models.Insights;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.ResponsesApi;
using ChatUiT.Server.Telemetry;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace ChatUiT.Server.Tests;

/// <summary>Checks the server's error codes and the places that send them.</summary>
public class ServerErrorCodeTests
{
    private static IReadOnlyList<ErrorCode> AllCodes() => typeof(ErrorCodes)
        .GetFields(BindingFlags.Public | BindingFlags.Static)
        .Where(field => field.FieldType == typeof(ErrorCode))
        .Select(field => (ErrorCode)field.GetValue(null)!)
        .ToList();

    [Fact]
    public void Every_code_is_unique_and_well_formed()
    {
        var codes = AllCodes();

        Assert.All(codes, code => Assert.Matches(new Regex("^E[0-9]{4}$"), code.Code));
        Assert.All(codes, code => Assert.False(string.IsNullOrWhiteSpace(code.Message)));
        Assert.Equal(codes.Count, codes.Select(code => code.Code).Distinct().Count());
    }

    [Fact]
    public void Server_codes_are_in_their_ranges()
    {
        static bool InServerRange(int number) => number is >= 2000 and <= 2299 or >= 4000 and <= 4999 or >= 5000 and <= 5499;

        Assert.All(AllCodes(), code => Assert.True(InServerRange(int.Parse(code.Code[1..])), code.Code));
    }

    [Fact]
    public void Rest_body_carries_message_code_reference_and_own_fields()
    {
        using var activity = new Activity("test").Start();
        var reference = ErrorReference.Current()!;

        var body = ApiErrors.Body(ErrorCodes.ChatNameTooLong, "Chat name cannot be longer than 200 characters.", new { Error = "too_long", InvalidIds = new[] { "a" } });

        Assert.Equal($"Chat name cannot be longer than 200 characters. (E4017, ref {reference})", body["message"]);
        Assert.Equal("E4017", body["errorCode"]);
        Assert.Equal(reference, body["ref"]);
        Assert.Equal("too_long", body["error"]);
        Assert.Equal(new[] { "a" }, body["invalidIds"]);
    }

    [Fact]
    public void Several_errors_share_one_text_with_every_code()
    {
        using var activity = new Activity("test").Start();
        var reference = ErrorReference.Current();

        var body = ApiErrors.Body([ErrorCodes.ImageSizeRequired, ErrorCodes.ImageCountOutOfRange]);

        Assert.Equal($"The model needs a size. Too many images per request. (E5043, E5046, ref {reference})", body["message"]);
        Assert.Equal("E5043", body["errorCode"]);
    }

    [Fact]
    public void Image_validator_codes_each_problem()
    {
        var capabilities = new ImageModelCapabilities { SupportsAutoSize = true, MaxImagesPerRequest = 1 };

        var problems = ImageParameterValidator.Validate(capabilities, new ImageGenerationParameters { Prompt = "a cat", Count = 3 });

        var problem = Assert.Single(problems);
        Assert.Equal(ErrorCodes.ImageCountOutOfRange.Code, problem.Code);
        Assert.Equal("The model makes 1 to 1 images per request.", problem.Message);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "content_filter", "E5002")]
    [InlineData(HttpStatusCode.TooManyRequests, null, "E5003")]
    [InlineData(HttpStatusCode.BadRequest, "invalid_size", "E5004")]
    [InlineData(HttpStatusCode.InternalServerError, null, "E5005")]
    public void Image_service_failures_get_their_code(HttpStatusCode status, string? code, string expected)
    {
        var failure = ImageApiHttp.Failure(status, code, "reason");

        Assert.Equal(expected, failure.Error.Code);
        Assert.Equal(failure.Message, failure.Error.Message);
    }

    [Fact]
    public void Responses_error_body_keeps_its_code_and_formats_its_message()
    {
        var exception = ResponsesApiException.BadRequest(ErrorCodes.ResponsesTemperatureOutOfRange, "temperature must be between 0 and 2.", "temperature", "invalid_value");

        var detail = exception.ToBody().Error;

        Assert.Equal("invalid_value", detail.Code);
        Assert.StartsWith("temperature must be between 0 and 2. (E2034", detail.Message);
    }

    [Fact]
    public void Failed_response_carries_the_formatted_text()
    {
        var writer = new ResponsesEventWriter(new ResponseObject { Id = "resp_1", Model = "m" }, events: null);

        writer.Failed(ErrorCodes.ResponsesRunFailed);

        Assert.Equal("failed", writer.Response.Status);
        Assert.Equal("server_error", writer.Response.Error!.Code);
        Assert.Contains("(E2023", writer.Response.Error.Message);
    }

    [Fact]
    public void Insights_failure_carries_its_code()
    {
        var table = InsightsTableDto.Failed(InsightsErrors.NoAccess);

        Assert.Equal(InsightsErrors.NoAccess, table.Error);
        Assert.Equal("E4212", table.ErrorCode);
        Assert.Contains("(E4212", table.Message);
    }

    [Fact]
    public async Task Unhandled_exception_answers_with_the_coded_body()
    {
        using var activity = new Activity("test").Start();
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var handler = new GlobalExceptionHandler(new AppTelemetry(NullLogger<AppTelemetry>.Instance));

        Assert.True(await handler.TryHandleAsync(context, new InvalidOperationException("boom"), CancellationToken.None));

        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal(500, context.Response.StatusCode);
        Assert.Equal("E4000", json.RootElement.GetProperty("errorCode").GetString());
        Assert.Equal($"Internal server error. (E4000, ref {ErrorReference.Current()})", json.RootElement.GetProperty("message").GetString());
        Assert.Equal(ErrorReference.Current(), json.RootElement.GetProperty("ref").GetString());
        Assert.DoesNotContain("boom", json.RootElement.GetRawText());
    }

    [Fact]
    public async Task Every_response_carries_the_reference_header()
    {
        string? reference = null;
        using var host = await new HostBuilder()
            .ConfigureWebHost(web => web
                .UseTestServer()
                .Configure(app =>
                {
                    app.Use(async (context, next) =>
                    {
                        using var activity = new Activity("request").Start();
                        reference = ErrorReference.Current();
                        await next(context);
                    });
                    app.UseMiddleware<ErrorReferenceMiddleware>();
                    app.Run(context => context.Response.WriteAsync("ok"));
                }))
            .StartAsync();

        var response = await host.GetTestClient().GetAsync("/");

        Assert.NotNull(reference);
        Assert.Equal(reference, Assert.Single(response.Headers.GetValues(ErrorReference.HeaderName)));
    }
}
