using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using ChatUiT.Server.Controllers;
using ChatUiT.Server.Services.Agents.M365;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.Tools;
using ChatUiT.Server.Telemetry;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;
using OpenTelemetry;
using OpenTelemetry.Logs;

namespace ChatUiT.Server.Tests;

/// <summary>
/// Pushes a marker string through the paths where content can reach telemetry and fails when the
/// marker shows up in what would be exported or written to the console.
/// </summary>
public class TelemetryCanaryTests
{
    private const string Marker = "CANARY-7f3a9c-content";

    [Fact]
    public void External_exception_message_is_removed()
    {
        var original = Catch(() => External.Library.Thrower.Throw(new HttpRequestException(Marker)));

        var redacted = ExceptionRedaction.Redact(original)!;

        Assert.DoesNotContain(Marker, redacted.ToString());
        Assert.IsType<HttpRequestException>(redacted);
        Assert.False(string.IsNullOrEmpty(redacted.StackTrace));
        Assert.Contains(Marker, original.Message);
    }

    [Fact]
    public void Json_parser_message_is_removed()
    {
        var original = Catch(() => JsonSerializer.Deserialize<Dictionary<string, string>>("{\"a\": " + Marker + "}"));

        var redacted = ExceptionRedaction.Redact(original)!;

        Assert.Equal(ExceptionRedaction.RemovedMessage, redacted.Message);
        Assert.DoesNotContain("CANARY", redacted.ToString());
    }

    [Fact]
    public void Own_message_is_kept()
    {
        var original = Catch(() => throw new InvalidOperationException("Model 42 not found"));

        Assert.Same(original, ExceptionRedaction.Redact(original));
    }

    public static TheoryData<Func<Exception>> ContentCarrying => new()
    {
        () => new ToolArgumentException(Marker),
        () => new GraphRequestException(HttpStatusCode.BadRequest, Marker),
        () => new AiTurnFailedException(Marker, ErrorCategories.ProviderRefused, "refusal"),
        () => new ImageGenerationFailedException(Marker, ErrorCategories.ProviderRefused, "content_filter")
    };

    [Theory]
    [MemberData(nameof(ContentCarrying))]
    public void Content_carrying_message_is_removed_even_when_thrown_by_own_code(Func<Exception> create)
    {
        var original = Catch(() => throw create());

        var redacted = ExceptionRedaction.Redact(original)!;

        Assert.DoesNotContain(Marker, redacted.ToString());
        Assert.Equal(original.GetType(), redacted.GetType());
    }

    [Fact]
    public void External_inner_message_is_removed_and_own_outer_message_kept()
    {
        var inner = Catch(() => External.Library.Thrower.Throw(new FormatException(Marker)));
        var original = Catch(() => throw new InvalidOperationException("The arguments are not valid JSON.", inner));

        var redacted = ExceptionRedaction.Redact(original)!;

        Assert.Equal("The arguments are not valid JSON.", redacted.Message);
        Assert.DoesNotContain(Marker, redacted.ToString());
        Assert.Contains(Marker, original.ToString());
    }

    [Fact]
    public void Aggregate_exception_is_replaced()
    {
        var inner = Catch(() => External.Library.Thrower.Throw(new HttpRequestException(Marker)));
        var original = new AggregateException(inner);

        var redacted = ExceptionRedaction.Redact(original)!;

        Assert.IsType<RedactedException>(redacted);
        Assert.DoesNotContain(Marker, redacted.ToString());
    }

    [Fact]
    public void Exported_log_records_hold_no_marker()
    {
        var exported = new List<string>();
        using (var factory = LoggerFactory.Create(builder => builder.AddOpenTelemetry(options =>
        {
            options.IncludeFormattedMessage = true;
            options.IncludeScopes = true;
            options.AddProcessor(new TelemetryLogProcessor("test-version", "Test"));
            options.AddProcessor(new SimpleLogRecordExportProcessor(new CapturingExporter(exported)));
        })))
        {
            var telemetry = new AppTelemetry(factory.CreateLogger<AppTelemetry>());
            var providerFailure = Catch(() => External.Library.Thrower.Throw(new HttpRequestException(Marker)));
            var turnFailure = Catch(() => throw new AiTurnFailedException(Marker, ErrorCategories.ProviderRefused, "refusal"));

            telemetry.GenerationFinished(Finished(), providerFailure);
            telemetry.GenerationFinished(Finished(), turnFailure);
            telemetry.RequestFailed("POST", "api/chats/{chatId}/messages", providerFailure);
            telemetry.ToolCallFinished(new ToolCallFinishedInfo("chat", "message", "search_mail", "m365", "server", "Error", 12, null),
                Catch(() => throw new ToolArgumentException(Marker)));
        }

        Assert.NotEmpty(exported);
        Assert.All(exported, record => Assert.DoesNotContain(Marker, record));
        Assert.Contains(exported, record => record.Contains("microsoft.custom_event.name=generation.finished") && !record.Contains("exception="));
        Assert.Contains(exported, record => record.Contains("event.name=generation.finished") && record.Contains("exception=System.Net.Http.HttpRequestException"));
    }

    [Fact]
    public void Console_lines_hold_no_marker()
    {
        var formatter = new RedactingConsoleFormatter(new StaticOptionsMonitor<ConsoleFormatterOptions>(new ConsoleFormatterOptions()));
        var exception = Catch(() => External.Library.Thrower.Throw(new HttpRequestException(Marker)));
        var entry = new Microsoft.Extensions.Logging.Abstractions.LogEntry<string>(LogLevel.Error, "Test", default, "request.failed", exception, (state, _) => state);
        using var writer = new StringWriter();

        formatter.Write(in entry, null, writer);

        Assert.Contains("request.failed", writer.ToString());
        Assert.DoesNotContain(Marker, writer.ToString());
    }

    [Fact]
    public void Access_token_is_removed_from_incoming_urls()
    {
        var activity = Run(ActivityKind.Server, activity =>
        {
            activity.SetTag("url.query", $"?id=abc&access_token={Marker}");
            activity.SetTag("url.full", $"https://ki-beta.uit.no/apphub?id=abc&access_token={Marker}");
        });

        Assert.Equal("?id=abc", activity.GetTagItem("url.query"));
        Assert.Equal("https://ki-beta.uit.no/apphub?id=abc", activity.GetTagItem("url.full"));
    }

    [Fact]
    public void Query_string_is_removed_from_graph_urls()
    {
        var activity = Run(ActivityKind.Client, activity =>
        {
            activity.SetTag("server.address", "graph.microsoft.com");
            activity.SetTag("url.full", $"https://graph.microsoft.com/v1.0/me/messages?$search=\"{Marker}\"&$top=10");
            activity.SetStatus(ActivityStatusCode.Error, Marker);
        });

        Assert.Equal("https://graph.microsoft.com/v1.0/me/messages", activity.GetTagItem("url.full"));
        Assert.Null(activity.StatusDescription);
    }

    [Fact]
    public void Exception_events_on_activities_hold_no_marker()
    {
        var inner = Catch(() => External.Library.Thrower.Throw(new FormatException(Marker)));
        var exception = Catch(() => External.Library.Thrower.Throw(new HttpRequestException(Marker + " outer", inner)));
        var activity = Run(ActivityKind.Client, activity => activity.AddException(exception));

        var tags = activity.Events.Single(e => e.Name == "exception").Tags.ToList();

        Assert.All(tags, tag => Assert.DoesNotContain(Marker, tag.Value?.ToString() ?? string.Empty));
        Assert.Contains(tags, tag => tag.Key == "exception.type" && (string?)tag.Value == typeof(HttpRequestException).FullName);
        Assert.Contains(tags, tag => tag.Key == "exception.stacktrace" && ((string?)tag.Value ?? string.Empty).Contains("at External.Library.Thrower.Throw"));
    }

    [Fact]
    public void Other_outgoing_query_strings_are_kept()
    {
        var activity = Run(ActivityKind.Client, activity =>
        {
            activity.SetTag("server.address", "example.openai.azure.com");
            activity.SetTag("url.full", "https://example.openai.azure.com/openai/deployments?api-version=2022-12-01");
        });

        Assert.Equal("https://example.openai.azure.com/openai/deployments?api-version=2022-12-01", activity.GetTagItem("url.full"));
    }

    [Fact]
    public void Client_records_with_unknown_fields_or_bad_values_are_rejected_without_their_values()
    {
        var logger = new CapturingLogger();
        var controller = new TelemetryController(new AppTelemetry(logger));
        var batch = new TelemetryController.ClientBatchDto
        {
            Records =
            [
                new() { Name = "client.page_viewed", Fields = Fields(("route", "/chat/:chatId"), ("content", Marker)) },
                new() { Name = "client.error", Fields = Fields(("kind", Marker)) },
                new() { Name = "client.error", Fields = Fields(("kind", "render"), ("message", new string('x', TelemetryController.MaxStringLength) + Marker)) },
                new() { Name = "client.message_copied", Fields = Fields(("copied", "code")) }
            ]
        };

        controller.Post(batch);

        Assert.DoesNotContain(Marker, logger.Text);
        Assert.Contains("event.name=client.message_copied", logger.Text);
        Assert.Equal(3, logger.Records.Count(r => r.Contains("event.name=client.telemetry_rejected")));
    }

    [Theory]
    [InlineData("?access_token=x", "")]
    [InlineData("?a=1&access_token=x&b=2", "?a=1&b=2")]
    [InlineData("?a=1", "?a=1")]
    [InlineData("https://h/p?access_token=x", "https://h/p")]
    [InlineData("https://h/p", "https://h/p")]
    public void Remove_query_parameter(string input, string expected)
    {
        Assert.Equal(expected, TelemetryUrls.RemoveQueryParameter(input, "access_token"));
    }

    private static GenerationFinishedInfo Finished() =>
        new("chat-1", "message-1", "gpt-test", Outcomes.Failed, 100, null, 0, 0, 0, 1, 10, 0, 0, 0, null, false);

    private static Exception Catch(Action action)
    {
        try
        {
            action();
        }
        catch (Exception ex)
        {
            return ex;
        }

        throw new InvalidOperationException("Nothing was thrown.");
    }

    private static Activity Run(ActivityKind kind, Action<Activity> configure)
    {
        using var source = new ActivitySource("ChatUiT.Server.Tests");
        using var listener = new ActivityListener
        {
            ShouldListenTo = s => s.Name == "ChatUiT.Server.Tests",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded
        };
        ActivitySource.AddActivityListener(listener);

        var activity = source.StartActivity("test", kind)!;
        configure(activity);
        activity.Stop();
        new TelemetryActivityProcessor("test-version", "Test").OnEnd(activity);
        return activity;
    }

    private static Dictionary<string, JsonElement> Fields(params (string Key, string Value)[] fields) =>
        fields.ToDictionary(f => f.Key, f => JsonSerializer.SerializeToElement(f.Value));

    /// <summary>Writes each exported record as text: attributes, formatted message, and the exception with its inner exceptions.</summary>
    private sealed class CapturingExporter(List<string> records) : BaseExporter<LogRecord>
    {
        public override ExportResult Export(in Batch<LogRecord> batch)
        {
            foreach (var record in batch)
            {
                var text = new StringBuilder();
                text.Append(record.FormattedMessage).Append(' ');
                foreach (var (key, value) in record.Attributes ?? [])
                {
                    text.Append(key).Append('=').Append(value).Append(' ');
                }

                if (record.Exception != null)
                {
                    text.Append("exception=").Append(record.Exception.GetType().FullName).Append(' ').Append(record.Exception);
                }

                records.Add(text.ToString());
            }

            return ExportResult.Success;
        }
    }

    private sealed class CapturingLogger : ILogger<AppTelemetry>
    {
        public List<string> Records { get; } = new();

        public string Text => string.Join("\n", Records);

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var text = new StringBuilder(formatter(state, exception));
            if (state is IEnumerable<KeyValuePair<string, object?>> items)
            {
                foreach (var (key, value) in items)
                {
                    text.Append(' ').Append(key).Append('=').Append(value);
                }
            }

            Records.Add(text.ToString());
        }
    }

    private sealed class StaticOptionsMonitor<T>(T value) : IOptionsMonitor<T>
    {
        public T CurrentValue => value;

        public T Get(string? name) => value;

        public IDisposable? OnChange(Action<T, string?> listener) => null;
    }
}
