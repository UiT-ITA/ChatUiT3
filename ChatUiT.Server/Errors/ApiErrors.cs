using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace ChatUiT.Server.Errors;

/// <summary>
/// REST error responses: a JSON body with <c>message</c> (the formatted text), <c>errorCode</c> and
/// <c>ref</c>, plus the endpoint's own fields.
/// </summary>
public static class ApiErrors
{
    /// <summary>
    /// The body for <paramref name="error"/>. <paramref name="message"/> replaces the code's text.
    /// The properties of <paramref name="fields"/> are added with camelCase names.
    /// </summary>
    public static Dictionary<string, object?> Body(ErrorCode error, string? message = null, object? fields = null)
        => Build(error.Code, UserError.Format(message ?? error.Message, error.Code), fields);

    /// <summary>The body for several errors at once: <see cref="Format(IReadOnlyList{ErrorCode})"/>, with the first code as <c>errorCode</c>.</summary>
    public static Dictionary<string, object?> Body(IReadOnlyList<ErrorCode> errors, object? fields = null)
        => Build(errors[0].Code, Format(errors), fields);

    /// <summary>Several errors as one text: their messages, then their codes and the reference.</summary>
    public static string Format(IReadOnlyList<ErrorCode> errors)
        => UserError.Format(string.Join(" ", errors.Select(e => e.Message)), string.Join(", ", errors.Select(e => e.Code).Distinct()));

    private static Dictionary<string, object?> Build(string code, string text, object? fields)
    {
        var body = new Dictionary<string, object?>();
        if (fields != null)
        {
            foreach (var property in fields.GetType().GetProperties())
            {
                body[JsonNamingPolicy.CamelCase.ConvertName(property.Name)] = property.GetValue(fields);
            }
        }

        body["message"] = text;
        body["errorCode"] = code;
        body["ref"] = ErrorReference.Current();
        return body;
    }

    public static ObjectResult Result(int status, ErrorCode error, string? message = null, object? fields = null)
        => new(Body(error, message, fields)) { StatusCode = status };

    public static ObjectResult BadRequest(ErrorCode error, string? message = null, object? fields = null)
        => Result(StatusCodes.Status400BadRequest, error, message, fields);

    public static ObjectResult BadRequest(IReadOnlyList<ErrorCode> errors, object? fields = null)
        => new(Body(errors, fields)) { StatusCode = StatusCodes.Status400BadRequest };

    public static ObjectResult NotFound(ErrorCode error, string? message = null, object? fields = null)
        => Result(StatusCodes.Status404NotFound, error, message, fields);

    public static ObjectResult Conflict(ErrorCode error, string? message = null, object? fields = null)
        => Result(StatusCodes.Status409Conflict, error, message, fields);
}
