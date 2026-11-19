namespace ChatUiT.Server.Errors;

/// <summary>Sets the <see cref="ErrorReference.HeaderName"/> header on every response of a traced request.</summary>
public sealed class ErrorReferenceMiddleware
{
    private readonly RequestDelegate _next;

    public ErrorReferenceMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        var reference = ErrorReference.Current();
        if (reference != null)
        {
            context.Response.OnStarting(() =>
            {
                context.Response.Headers[ErrorReference.HeaderName] = reference;
                return Task.CompletedTask;
            });
        }

        return _next(context);
    }
}
