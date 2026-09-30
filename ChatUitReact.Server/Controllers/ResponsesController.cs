using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading.Channels;
using ChatUitReact.Server.Authentication;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Services.Agents;
using ChatUitReact.Server.Services.AiProviders;
using ChatUitReact.Server.Services.ApiCatalog;
using ChatUitReact.Server.Services.ResponsesApi;
using ChatUitReact.Server.Services.Tools;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

/// <summary>
/// The OpenAI Responses-compatible API. Stateless: the client sends the whole item history with
/// every request, and nothing about the conversation is stored. The "models" are the API catalog
/// entries the caller may use; any other model, or one the caller may not use, is 404
/// <c>model_not_found</c>. A request is validated in full before a stream starts, so every
/// refusal is an HTTP error with the <c>{error:{message,type,param,code}}</c> body.
/// </summary>
[ApiController]
[Route("api/v1")]
[Authorize]
public class ResponsesController : ControllerBase
{
    private readonly IApiCatalogService _catalog;
    private readonly InternalAgentRunner _agentRunner;
    private readonly ResponsesRequestMapper _mapper;
    private readonly ResponsesRunner _runner;
    private readonly UserService _userService;
    private readonly IUserTokenProviderFactory _tokenProviders;
    private readonly ILogger<ResponsesController> _logger;

    public ResponsesController(
        IApiCatalogService catalog,
        InternalAgentRunner agentRunner,
        ResponsesRequestMapper mapper,
        ResponsesRunner runner,
        UserService userService,
        IUserTokenProviderFactory tokenProviders,
        ILogger<ResponsesController> logger)
    {
        _catalog = catalog;
        _agentRunner = agentRunner;
        _mapper = mapper;
        _runner = runner;
        _userService = userService;
        _tokenProviders = tokenProviders;
        _logger = logger;
    }

    [HttpGet("models")]
    public async Task<IResult> ListModels()
    {
        try
        {
            var usable = await _catalog.GetUsableAsync(_userService.GetUserAccess(User));
            return Json(new ModelList { Data = usable.Select(ToModelObject).ToList() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing API models");
            return ServerError();
        }
    }

    [HttpGet("models/{id}")]
    public async Task<IResult> GetModel(string id)
    {
        try
        {
            var target = await _catalog.ResolveAsync(id, _userService.GetUserAccess(User));
            return target == null ? Error(ResponsesApiException.ModelNotFound(id)) : Json(ToModelObject(target));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting API model {Model}", id);
            return ServerError();
        }
    }

    [HttpPost("responses")]
    public async Task<IResult> CreateResponse()
    {
        var cancellationToken = HttpContext.RequestAborted;

        CreateResponseRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<CreateResponseRequest>(Request.Body, ResponsesJson.Options, cancellationToken);
        }
        catch (JsonException ex)
        {
            return Error(ResponsesApiException.BadRequest($"The request body is not valid JSON: {ex.Message}", code: "invalid_json"));
        }

        if (request == null)
        {
            return Error(ResponsesApiException.BadRequest("The request body must be a JSON object.", code: "invalid_json"));
        }

        if (string.IsNullOrWhiteSpace(request.Model))
        {
            return Error(ResponsesApiException.BadRequest("model is required.", "model", "missing_required_parameter"));
        }

        ApiTarget? target;
        ResponseObject response;
        ToolExecutionContext context;
        MappedRequest mapped;
        var access = _userService.GetUserAccess(User);
        try
        {
            target = await _catalog.ResolveAsync(request.Model, access);
            if (target == null)
            {
                return Error(ResponsesApiException.ModelNotFound(request.Model));
            }

            response = new ResponseObject
            {
                Id = $"resp_{Guid.NewGuid():N}",
                CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Model = target.Entry.PublicId
            };

            var identity = _userService.GetUserIdentity(User);
            context = new ToolExecutionContext
            {
                UserId = identity.UserId,
                ChatId = null,
                MessageId = response.Id,
                Access = access,
                // The bearer token of this request is the On-Behalf-Of assertion, including the
                // request that follows a consent grant.
                Tokens = _tokenProviders.Create(User, Request.BearerToken()),
                UserDisplayName = identity.DisplayName,
                UserPrincipalName = identity.Username,
                Model = target.Model,
                Endpoint = target.Endpoint,
                Mode = InteractionMode.Defer,
                // Clients show the summaries in a narrow pane, so the short form is asked for,
                // for the request's own turns and for nested agent runs.
                ReasoningSummaryLength = ReasoningSummaryLength.Concise
            };

            // An agent runs with the same setup as on every other path; its functions are the server tools.
            InternalAgentSetup? setup = null;
            if (target.Agent != null)
            {
                setup = await _agentRunner.SetupAsync(target.Agent, context);
                if (setup == null)
                {
                    return Error(ResponsesApiException.ModelNotFound(request.Model));
                }
            }

            mapped = _mapper.Map(request, target, setup, context);
        }
        catch (ResponsesApiException ex)
        {
            return Error(ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error preparing a response on {Model}", request.Model);
            return ServerError();
        }

        if (mapped.Stream)
        {
            return TypedResults.ServerSentEvents(StreamAsync(
                writer => _runner.RunAsync(target, mapped, context, writer, cancellationToken), response, cancellationToken));
        }

        var collector = new ResponsesEventWriter(response, events: null);
        await _runner.RunAsync(target, mapped, context, collector, cancellationToken);
        return Json(collector.Response);
    }

    /// <summary>
    /// Runs the response while the events are sent. Aborting the request cancels the run through
    /// the token; the run stops at its next await.
    /// </summary>
    private async IAsyncEnumerable<SseItem<string>> StreamAsync(
        Func<ResponsesEventWriter, Task> run,
        ResponseObject response,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var channel = Channel.CreateUnbounded<SseItem<string>>(new UnboundedChannelOptions { SingleReader = true, SingleWriter = true });
        var writer = new ResponsesEventWriter(response, channel.Writer);

        var worker = Task.Run(async () =>
        {
            try
            {
                await run(writer);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // The client went away; there is nobody to tell.
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Streaming response {ResponseId} failed", response.Id);
            }
            finally
            {
                channel.Writer.TryComplete();
            }
        }, CancellationToken.None);

        await foreach (var item in channel.Reader.ReadAllAsync(cancellationToken))
        {
            yield return item;
        }

        await worker;
    }

    private static ModelObject ToModelObject(ApiTarget target) => new()
    {
        Id = target.Entry.PublicId,
        Created = new DateTimeOffset(DateTime.SpecifyKind(target.Entry.UpdatedAt, DateTimeKind.Utc)).ToUnixTimeSeconds()
    };

    private static IResult Json<T>(T body, int statusCode = StatusCodes.Status200OK)
        => TypedResults.Json(body, ResponsesJson.Options, statusCode: statusCode);

    private static IResult Error(ResponsesApiException ex) => Json(ex.ToBody(), ex.Status);

    private static IResult ServerError() => Json(
        new ResponsesApiException(500, "The server could not handle the request.", type: "server_error").ToBody(),
        StatusCodes.Status500InternalServerError);
}
