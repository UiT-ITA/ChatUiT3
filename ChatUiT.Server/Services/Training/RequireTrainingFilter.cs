using ChatUiT.Server.Telemetry;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.SignalR;

namespace ChatUiT.Server.Services.Training;

/// <summary>Marks a controller or action that a user can call before passing the mandatory training.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AllowWithoutTrainingAttribute : Attribute
{
}

/// <summary>
/// Answers 403 to a signed-in user without a stored training result, on every controller action
/// that is not marked <see cref="AllowWithoutTrainingAttribute"/>.
/// </summary>
public sealed class RequireTrainingFilter : IAsyncAuthorizationFilter
{
    public const string Reason = "training_required";

    private readonly TrainingService _trainingService;
    private readonly UserService _userService;
    private readonly AppTelemetry _telemetry;

    public RequireTrainingFilter(TrainingService trainingService, UserService userService, AppTelemetry telemetry)
    {
        _trainingService = trainingService;
        _userService = userService;
        _telemetry = telemetry;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            return;
        }

        if (context.ActionDescriptor.EndpointMetadata.OfType<AllowWithoutTrainingAttribute>().Any())
        {
            return;
        }

        if (await _trainingService.HasCompletedAsync(_userService.GetCurrentUserId(user)))
        {
            return;
        }

        _telemetry.AccessDenied(context.ActionDescriptor.AttributeRouteInfo?.Template, null, Reason);
        context.Result = new ObjectResult(new { message = "The mandatory training must be completed first.", code = Reason })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
}

/// <summary>Closes a hub connection from a user without a stored training result.</summary>
public sealed class RequireTrainingHubFilter : IHubFilter
{
    private readonly TrainingService _trainingService;
    private readonly AppTelemetry _telemetry;

    public RequireTrainingHubFilter(TrainingService trainingService, AppTelemetry telemetry)
    {
        _trainingService = trainingService;
        _telemetry = telemetry;
    }

    public async Task OnConnectedAsync(HubLifetimeContext context, Func<HubLifetimeContext, Task> next)
    {
        var user = context.Context.User;
        if (user?.Identity?.IsAuthenticated == true
            && !await _trainingService.HasCompletedAsync(new UserService(_telemetry).GetCurrentUserId(user)))
        {
            _telemetry.AccessDenied("/apphub", null, RequireTrainingFilter.Reason);
            context.Context.Abort();
            return;
        }

        await next(context);
    }
}
