using System.Diagnostics;

namespace ChatUiT.Server.Errors;

/// <summary>
/// One kind of error a user can see: its code (E + 4 digits, listed in docs/error-codes.md) and
/// the English text shown with it.
/// </summary>
public sealed record ErrorCode(string Code, string Message)
{
    /// <summary>The text shown to the user: the message, the code and the reference of the current request.</summary>
    public string Format() => UserError.Format(Message, Code);

    /// <summary>The message and the code, without a reference: "message (E2000)".</summary>
    public string FormatWithoutReference() => $"{Message} ({Code})";

    public override string ToString() => Code;
}

/// <summary>Formats user-facing error texts as "message (E1234, ref 3f9a1c2e)".</summary>
public static class UserError
{
    public static string Format(string message, string code)
    {
        var reference = ErrorReference.Current();
        return reference == null ? $"{message} ({code})" : $"{message} ({code}, ref {reference})";
    }
}

/// <summary>
/// The reference of the current request: the first 8 hex digits of the trace id, which is the
/// operation_Id in Application Insights. Null outside a traced request.
/// </summary>
public static class ErrorReference
{
    public const int Length = 8;

    /// <summary>The response header that carries the reference on every HTTP response.</summary>
    public const string HeaderName = "X-ChatUiT-Ref";

    public static string? Current() => From(Activity.Current);

    public static string? From(Activity? activity)
        => activity == null || activity.TraceId == default ? null : activity.TraceId.ToHexString()[..Length];
}
