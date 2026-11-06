using System.Reflection;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.Extensions.Logging.Console;
using OpenTelemetry;
using OpenTelemetry.Instrumentation.AspNetCore;
using OpenTelemetry.Instrumentation.Http;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace ChatUiT.Server.Telemetry;

public static class TelemetrySetup
{
    public const string ServiceName = "ChatUiT.Server";
    public const string ConnectionStringKey = "APPLICATIONINSIGHTS_CONNECTION_STRING";

    /// <summary>
    /// Registers logging and telemetry: the console with redacted exceptions, the
    /// <see cref="AppTelemetry"/> catalog, the global exception handler, and, when
    /// <see cref="ConnectionStringKey"/> is set, export to Application Insights with every trace
    /// and log kept and Live Metrics off.
    /// </summary>
    public static void AddAppTelemetry(this WebApplicationBuilder builder)
    {
        builder.Logging.ClearProviders();
        builder.Logging.AddConsole(options => options.FormatterName = RedactingConsoleFormatter.FormatterName);
        builder.Logging.AddConsoleFormatter<RedactingConsoleFormatter, ConsoleFormatterOptions>();
        builder.Logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware", LogLevel.None);
        builder.Logging.AddFilter("System.Net.Http.HttpClient", LogLevel.Warning);

        builder.Services.AddSingleton<AppTelemetry>();
        builder.Services.AddSingleton<TelemetryHubFilter>();
        builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
        builder.Services.AddProblemDetails();

        if (string.IsNullOrWhiteSpace(builder.Configuration[ConnectionStringKey]))
        {
            return;
        }

        var version = ServiceVersion();
        var environment = builder.Environment.EnvironmentName;

        // Query strings are recorded as sent. TelemetryActivityProcessor removes access_token and Graph query strings.
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["OTEL_DOTNET_EXPERIMENTAL_ASPNETCORE_DISABLE_URL_QUERY_REDACTION"] = "true",
            ["OTEL_DOTNET_EXPERIMENTAL_HTTPCLIENT_DISABLE_URL_QUERY_REDACTION"] = "true"
        });

        builder.Services.ConfigureOpenTelemetryTracerProvider(tracing => tracing.AddProcessor(new TelemetryActivityProcessor(version, environment)));
        builder.Services.ConfigureOpenTelemetryLoggerProvider(logging => logging.AddProcessor(new TelemetryLogProcessor(version, environment)));
        // HTTP client and DNS metrics keep only these dimensions. Host and peer address are left out.
        builder.Services.ConfigureOpenTelemetryMeterProvider(metrics => metrics
            .AddView("http.client.*", new MetricStreamConfiguration
            {
                TagKeys = ["http.request.method", "http.response.status_code", "error.type", "network.protocol.version", "url.scheme", "http.connection.state"]
            })
            .AddView("dns.*", new MetricStreamConfiguration { TagKeys = ["error.type"] }));
        builder.Services.Configure<OpenTelemetryLoggerOptions>(options =>
        {
            options.IncludeScopes = true;
            options.IncludeFormattedMessage = true;
        });
        builder.Services.PostConfigure<AspNetCoreTraceInstrumentationOptions>(options => options.RecordException = false);
        builder.Services.PostConfigure<HttpClientTraceInstrumentationOptions>(options =>
        {
            options.RecordException = false;
            var previous = options.FilterHttpRequestMessage;
            options.FilterHttpRequestMessage = request => TelemetryHttp.IsTracked(request) && (previous?.Invoke(request) ?? true);
        });

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(ServiceName, serviceVersion: version))
            .UseAzureMonitor(options =>
            {
                options.SamplingRatio = 1.0F;
                options.TracesPerSecond = null;
                options.EnableTraceBasedLogsSampler = false;
                options.EnableLiveMetrics = false;
            });
    }

    /// <summary>The server's informational version, which carries the commit it was built from.</summary>
    public static string ServiceVersion() =>
        typeof(TelemetrySetup).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";
}
