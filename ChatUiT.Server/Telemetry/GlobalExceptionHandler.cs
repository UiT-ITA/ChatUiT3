using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// Records every exception a request does not handle as <c>request.failed</c> and answers 500 with
/// a problem body that carries no exception text. A request the client aborted is not recorded.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly AppTelemetry _telemetry;

    public GlobalExceptionHandler(AppTelemetry telemetry)
    {
        _telemetry = telemetry;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            httpContext.Response.StatusCode = 499;
            return true;
        }

        var route = (httpContext.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? httpContext.Request.Path.Value;
        _telemetry.RequestFailed(httpContext.Request.Method, route, exception);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Internal server error"
        }, cancellationToken);

        return true;
    }
}
