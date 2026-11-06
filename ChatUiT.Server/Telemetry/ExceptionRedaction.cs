using System.Reflection;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// An exception type whose message can hold content: message text, file content, Graph content,
/// tool arguments or results, or text from an external service. Its message is never logged.
/// </summary>
public interface IContentCarryingException
{
}

/// <summary>
/// Removes exception messages that may hold content before an exception is logged. A message is
/// kept when the exception was thrown by code in a <c>ChatUiT</c> namespace and its type is not an
/// <see cref="IContentCarryingException"/>. Every other message is replaced by
/// <see cref="RemovedMessage"/>. Type and stack trace are kept. The original exception is never
/// changed: a redacted exception is a copy.
/// </summary>
public static class ExceptionRedaction
{
    public const string RemovedMessage = "[message removed]";

    private const string OwnNamespacePrefix = "ChatUiT.";
    private const int MaxDepth = 16;

    private static readonly MethodInfo MemberwiseCloneMethod =
        typeof(object).GetMethod("MemberwiseClone", BindingFlags.Instance | BindingFlags.NonPublic)!;

    private static readonly FieldInfo? InnerExceptionField =
        typeof(Exception).GetField("_innerException", BindingFlags.Instance | BindingFlags.NonPublic);

    /// <summary>Whether the message of this exception, without its inner exceptions, may be logged.</summary>
    public static bool KeepsMessage(Exception exception)
    {
        if (exception is IContentCarryingException)
        {
            return false;
        }

        var thrower = exception.TargetSite?.DeclaringType;
        return thrower?.Namespace?.StartsWith(OwnNamespacePrefix, StringComparison.Ordinal) == true
            || thrower?.Namespace == "ChatUiT";
    }

    /// <summary>
    /// The exception as it may be logged: the same instance when every message in the tree may be
    /// kept, otherwise a copy with the messages removed.
    /// </summary>
    public static Exception? Redact(Exception? exception) => exception == null ? null : Redact(exception, 0);

    private static Exception Redact(Exception exception, int depth)
    {
        if (depth >= MaxDepth)
        {
            return new RedactedException(exception.GetType().FullName ?? exception.GetType().Name, null);
        }

        if (exception is AggregateException aggregate)
        {
            // An AggregateException becomes a stand-in that keeps its first inner exception.
            var first = aggregate.InnerExceptions.Count > 0 ? Redact(aggregate.InnerExceptions[0], depth + 1) : null;
            return new RedactedException(exception.GetType().FullName ?? nameof(AggregateException), first);
        }

        var keep = KeepsMessage(exception);
        var inner = exception.InnerException;
        var redactedInner = inner == null ? null : Redact(inner, depth + 1);

        if (keep && ReferenceEquals(inner, redactedInner))
        {
            return exception;
        }

        if (InnerExceptionField == null)
        {
            return new RedactedException(exception.GetType().FullName ?? exception.GetType().Name, redactedInner);
        }

        var copy = (Exception)MemberwiseCloneMethod.Invoke(exception, null)!;
        InnerExceptionField.SetValue(copy, redactedInner);

        if (!keep)
        {
            SetMessageFields(copy);
            if (!string.Equals(copy.Message, RemovedMessage, StringComparison.Ordinal))
            {
                // Falls back to a stand-in when the copy's message still differs.
                return new RedactedException(exception.GetType().FullName ?? exception.GetType().Name, redactedInner);
            }
        }

        return copy;
    }

    /// <summary>Sets every private <c>_message</c> field from the exception's type up to <see cref="Exception"/>.</summary>
    private static void SetMessageFields(Exception copy)
    {
        for (var type = copy.GetType(); type != null && type != typeof(object); type = type.BaseType)
        {
            var field = type.GetField("_message", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
            if (field != null && field.FieldType == typeof(string))
            {
                field.SetValue(copy, RemovedMessage);
            }
        }
    }
}

/// <summary>
/// Stands in for an exception whose message could not be removed in a copy. Its message names the
/// original type.
/// </summary>
public sealed class RedactedException : Exception
{
    public RedactedException(string originalType, Exception? inner)
        : base($"{ExceptionRedaction.RemovedMessage} ({originalType})", inner)
    {
        OriginalType = originalType;
    }

    public string OriginalType { get; }
}
