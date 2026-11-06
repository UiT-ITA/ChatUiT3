using System.Diagnostics;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.SignalR;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// The fields every record of a request shares: the user and the client. The client sends
/// <see cref="ClientHeader"/>, <see cref="VersionHeader"/> and <see cref="SessionHeader"/> on API
/// calls, and the same values as <c>client</c>, <c>client_version</c> and <c>client_session</c> in
/// the query string of the SignalR connection.
/// </summary>
public static partial class TelemetryContext
{
    public const string ClientHeader = "X-ChatUiT-Client";
    public const string VersionHeader = "X-ChatUiT-Version";
    public const string SessionHeader = "X-ChatUiT-Session";

    private const string ObjectIdClaim = "http://schemas.microsoft.com/identity/claims/objectidentifier";
    private const string UpnClaim = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn";
    private static readonly string[] KnownClients = ["web", "office"];

    public static List<KeyValuePair<string, object?>> Fields(ClaimsPrincipal? user, HttpRequest? request)
    {
        var fields = new List<KeyValuePair<string, object?>>(5);

        if (user?.Identity?.IsAuthenticated == true)
        {
            fields.Add(new(FieldNames.UserId, user.FindFirst(ObjectIdClaim)?.Value ?? user.FindFirst("oid")?.Value));
            fields.Add(new(FieldNames.UserUpn, user.FindFirst(ClaimTypes.Upn)?.Value ?? user.FindFirst(UpnClaim)?.Value ?? user.FindFirst(ClaimTypes.Email)?.Value));
        }

        if (request != null)
        {
            var client = Clean(Read(request, ClientHeader, "client"));
            fields.Add(new(FieldNames.ClientApp, client != null && KnownClients.Contains(client)
                ? client
                : request.Path.StartsWithSegments("/api/v1") ? "api" : "unknown"));
            fields.Add(new(FieldNames.ClientVersion, Clean(Read(request, VersionHeader, "client_version"))));
            fields.Add(new(FieldNames.ClientSession, Clean(Read(request, SessionHeader, "client_session"))));
        }

        return fields.Where(f => f.Value != null).ToList();
    }

    /// <summary>Sets the fields as tags on the request's activity.</summary>
    public static void Tag(Activity? activity, IEnumerable<KeyValuePair<string, object?>> fields)
    {
        if (activity == null)
        {
            return;
        }

        foreach (var (key, value) in fields)
        {
            activity.SetTag(key, value);
            if (key == FieldNames.UserId)
            {
                activity.SetTag("enduser.id", value);
            }
        }
    }

    private static string? Read(HttpRequest request, string header, string queryKey)
    {
        var value = request.Headers[header].ToString();
        return string.IsNullOrEmpty(value) ? request.Query[queryKey].ToString() : value;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) || value.Length > 64 || !SafeValue().IsMatch(value) ? null : value;

    [GeneratedRegex("^[A-Za-z0-9._+-]+$")]
    private static partial Regex SafeValue();
}

/// <summary>
/// Opens a log scope with <see cref="TelemetryContext.Fields"/> for every request, and records
/// <c>auth.access_denied</c> for every 401 and 403 response.
/// </summary>
public sealed class TelemetryContextMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TelemetryContextMiddleware> _logger;

    public TelemetryContextMiddleware(RequestDelegate next, ILogger<TelemetryContextMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppTelemetry telemetry)
    {
        var fields = TelemetryContext.Fields(context.User, context.Request);
        TelemetryContext.Tag(Activity.Current, fields);

        using (_logger.BeginScope(fields))
        {
            await _next(context);

            if (context.Response.StatusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
            {
                var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? context.Request.Path.Value;
                telemetry.AccessDenied(route, null, context.Response.StatusCode == StatusCodes.Status401Unauthorized ? "unauthenticated" : "forbidden");
            }
        }
    }
}

/// <summary>Opens the same scope for every hub method and records hub methods that throw.</summary>
public sealed class TelemetryHubFilter : IHubFilter
{
    private readonly ILogger<TelemetryHubFilter> _logger;
    private readonly AppTelemetry _telemetry;

    public TelemetryHubFilter(ILogger<TelemetryHubFilter> logger, AppTelemetry telemetry)
    {
        _logger = logger;
        _telemetry = telemetry;
    }

    public async ValueTask<object?> InvokeMethodAsync(HubInvocationContext invocationContext, Func<HubInvocationContext, ValueTask<object?>> next)
    {
        var fields = TelemetryContext.Fields(invocationContext.Context.User, invocationContext.Context.GetHttpContext()?.Request);
        using (_logger.BeginScope(fields))
        {
            try
            {
                return await next(invocationContext);
            }
            catch (Exception ex)
            {
                _telemetry.RequestFailed("HUB", $"/apphub/{invocationContext.HubMethodName}", ex);
                throw;
            }
        }
    }
}
