using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// Writes console log lines with exceptions passed through <see cref="ExceptionRedaction"/>, so
/// stdout carries the same exception text as the exported telemetry.
/// </summary>
public sealed class RedactingConsoleFormatter : ConsoleFormatter
{
    public const string FormatterName = "redacting";

    public RedactingConsoleFormatter(IOptionsMonitor<ConsoleFormatterOptions> options) : base(FormatterName)
    {
    }

    public override void Write<TState>(in LogEntry<TState> logEntry, IExternalScopeProvider? scopeProvider, TextWriter textWriter)
    {
        var message = logEntry.Formatter?.Invoke(logEntry.State, null);
        var exception = ExceptionRedaction.Redact(logEntry.Exception);
        if (message == null && exception == null)
        {
            return;
        }

        textWriter.Write(DateTime.UtcNow.ToString("O"));
        textWriter.Write(' ');
        textWriter.Write(Level(logEntry.LogLevel));
        textWriter.Write(' ');
        textWriter.Write(logEntry.Category);
        textWriter.Write(": ");
        textWriter.WriteLine(message);
        if (exception != null)
        {
            textWriter.WriteLine(exception.ToString());
        }
    }

    private static string Level(LogLevel level) => level switch
    {
        LogLevel.Trace => "trce",
        LogLevel.Debug => "dbug",
        LogLevel.Information => "info",
        LogLevel.Warning => "warn",
        LogLevel.Error => "fail",
        LogLevel.Critical => "crit",
        _ => "none"
    };
}
