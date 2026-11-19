using ChatUiT.Server.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.ApiCatalog;
using ChatUiT.Server.Services.TokenCounting;
using ChatUiT.Server.Telemetry;

namespace ChatUiT.Server.Controllers;

/// <summary>
/// Models of every type. Reads and deletes take any model; each type is created and updated
/// on its own route, with its own body.
/// </summary>
[ApiController]
[Route("api/admin/models")]
[Authorize(Roles = "Admin")]
public class AdminModelsController : ControllerBase
{
    private readonly IModelService _modelService;
    private readonly IApiCatalogService _catalog;
    private readonly IAiProviderRegistry _providers;
    private readonly AppTelemetry _telemetry;

    public AdminModelsController(IModelService modelService, IApiCatalogService catalog, IAiProviderRegistry providers, AppTelemetry telemetry)
    {
        _modelService = modelService;
        _catalog = catalog;
        _providers = providers;
        _telemetry = telemetry;
    }

    private void RecordChange(string action, Model? before, Model? after)
    {
        var diff = TelemetryDiff.Compute(before == null ? null : ModelDtoMapper.ToDto(before), after == null ? null : ModelDtoMapper.ToDto(after));
        _telemetry.AdminChanged("model", (after ?? before)!.Id, action, diff.Changed, diff.Changes);
    }

    [HttpGet]
    public async Task<ActionResult<List<ModelDto>>> GetModels()
    {
        var models = await _modelService.GetModelsAsync<Model>();
        return Ok(models.Select(ModelDtoMapper.ToDto).ToList());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ModelDto>> GetModel(string id)
    {
        var model = await _modelService.GetModelAsync<Model>(id);
        if (model == null)
        {
            return ApiErrors.NotFound(ErrorCodes.ModelNotFound, $"Model with id {id} not found.");
        }

        return Ok(ModelDtoMapper.ToDto(model));
    }

    [HttpPost("language")]
    public async Task<ActionResult<ModelDto>> CreateLanguageModel(SaveLanguageModelDto dto)
    {
        if (ValidateLanguageModel(dto) is { } problem)
        {
            return ApiErrors.BadRequest(problem);
        }

        var model = ToLanguageModel(dto, Guid.NewGuid().ToString());
        if (model.ExposedInApi && await _catalog.ModelExposureProblemAsync(model) is { } exposureProblem)
        {
            return ApiErrors.BadRequest(exposureProblem);
        }

        await _modelService.CreateModelAsync(model);
        RecordChange("created", null, model);
        return CreatedAtAction(nameof(GetModel), new { id = model.Id }, ModelDtoMapper.ToDto(model));
    }

    [HttpPut("language/{id}")]
    public async Task<ActionResult<ModelDto>> UpdateLanguageModel(string id, SaveLanguageModelDto dto)
    {
        if (ValidateLanguageModel(dto) is { } problem)
        {
            return ApiErrors.BadRequest(problem);
        }

        var model = ToLanguageModel(dto, id);
        if (model.ExposedInApi && await _catalog.ModelExposureProblemAsync(model) is { } exposureProblem)
        {
            return ApiErrors.BadRequest(exposureProblem);
        }

        return await SaveAsync(model);
    }

    [HttpPost("image")]
    public async Task<ActionResult<ModelDto>> CreateImageModel(SaveImageModelDto dto)
    {
        if (ValidateImageModel(dto) is { } problem)
        {
            return ApiErrors.BadRequest(problem);
        }

        var model = ToImageModel(dto, Guid.NewGuid().ToString());
        await _modelService.CreateModelAsync(model);
        RecordChange("created", null, model);
        return CreatedAtAction(nameof(GetModel), new { id = model.Id }, ModelDtoMapper.ToDto(model));
    }

    [HttpPut("image/{id}")]
    public async Task<ActionResult<ModelDto>> UpdateImageModel(string id, SaveImageModelDto dto)
    {
        if (ValidateImageModel(dto) is { } problem)
        {
            return ApiErrors.BadRequest(problem);
        }

        return await SaveAsync(ToImageModel(dto, id));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteModel(string id)
    {
        var existing = await _modelService.GetModelAsync<Model>(id);
        var deleted = await _modelService.DeleteModelAsync(id);
        if (!deleted)
        {
            return ApiErrors.NotFound(ErrorCodes.ModelNotFound, $"Model with id {id} not found.");
        }

        if (existing != null)
        {
            RecordChange("deleted", existing, null);
        }

        return NoContent();
    }

    // Runs one small request on the saved model through its endpoint and reports whether a result came back.
    [HttpPost("{id}/test")]
    public async Task<ActionResult<ModelTestResultDto>> TestModel(string id, CancellationToken cancellationToken)
    {
        var resolved = await _modelService.GetModelWithEndpointAsync<Model>(id);
        if (resolved == null)
        {
            if (await _modelService.GetModelAsync<Model>(id) == null)
            {
                return ApiErrors.NotFound(ErrorCodes.ModelNotFound, $"Model with id {id} not found.");
            }

            return Ok(FailedTest(ErrorCodes.ModelTestEndpointMissing));
        }

        var (endpoint, model) = resolved.Value;
        if (!_providers.Supports(endpoint.EndpointType))
        {
            return Ok(FailedTest(ErrorCodes.ModelTestProviderMissing with { Message = $"No AI provider is registered for endpoint type {endpoint.EndpointType}." }));
        }

        ModelTestResultDto result;
        try
        {
            result = model switch
            {
                LanguageModel language => await TestLanguageModelAsync(language, endpoint, cancellationToken),
                ImageModel image => await TestImageModelAsync(image, endpoint, cancellationToken),
                _ => FailedTest(ErrorCodes.ModelTestTypeNotSupported with { Message = $"{model.Type} models cannot be tested yet." })
            };
        }
        catch (Exception ex)
        {
            result = FailedTest(ProviderErrors.Classify(ex) ?? (ErrorCodes.ModelTestFailed with { Message = ex.Message }));
        }

        _telemetry.AdminModelTested(model.ModelId, result.Success ? Outcomes.Succeeded : Outcomes.Failed);
        return Ok(result);
    }

    private const string LanguageTestPrompt = "This is a connection test. Reply with the single word OK.";

    private const string ImageTestPrompt = "A small red circle on a white background.";

    private async Task<ModelTestResultDto> TestLanguageModelAsync(LanguageModel model, ModelEndpoint endpoint, CancellationToken cancellationToken)
    {
        var request = new AiRequest
        {
            Model = model,
            Endpoint = endpoint,
            Messages = AiInputItem.From(new List<ChatMessage>
            {
                new() { Role = AiChatRole.User, Content = LanguageTestPrompt }
            }),
            Parameters = ChatParameterResolver.Resolve(model.Capabilities, new ChatSettings { Model = model })
        };

        var text = await _providers.For(endpoint.EndpointType).CompleteTextAsync(request, cancellationToken);
        if (text.Length == 0)
        {
            return FailedTest(ErrorCodes.ModelTestNoText);
        }

        return new ModelTestResultDto { Success = true, Response = text };
    }

    // Asks for one image at the smallest preset and the lowest quality the model offers.
    private async Task<ModelTestResultDto> TestImageModelAsync(ImageModel model, ModelEndpoint endpoint, CancellationToken cancellationToken)
    {
        var capabilities = model.Capabilities;
        var parameters = new ImageGenerationParameters
        {
            Prompt = ImageTestPrompt,
            Size = capabilities.SizePresets.OrderBy(s => (long)s.Width * s.Height).FirstOrDefault(),
            Quality = capabilities.Qualities.Where(q => q != ImageQuality.Auto).Cast<ImageQuality?>().FirstOrDefault()
        };

        var problems = ImageParameterValidator.Validate(capabilities, parameters);
        if (problems.Count > 0)
        {
            return new ModelTestResultDto { Success = false, Error = ApiErrors.Format(problems) };
        }

        var request = new ImageRequest { Model = model, Endpoint = endpoint, Parameters = parameters };
        await foreach (var streamEvent in _providers.For(endpoint.EndpointType).GenerateImagesAsync(request, cancellationToken))
        {
            if (streamEvent is ImageStreamEvent.Image image)
            {
                return new ModelTestResultDto { Success = true, Response = $"{image.Format} image, {image.Content.Length / 1024} KB" };
            }
        }

        return FailedTest(ErrorCodes.ModelTestNoImage);
    }

    private static ModelTestResultDto FailedTest(ErrorCode error) => new() { Success = false, Error = error.Format() };

    // Saves an update; a model of another type under the id is refused.
    private async Task<ActionResult<ModelDto>> SaveAsync(Model model)
    {
        var existing = await _modelService.GetModelAsync<Model>(model.Id);
        if (existing == null)
        {
            return ApiErrors.NotFound(ErrorCodes.ModelNotFound, $"Model with id {model.Id} not found.");
        }

        if (existing.Type != model.Type)
        {
            return ApiErrors.BadRequest(ErrorCodes.ModelTypeMismatch, $"Model {model.Id} is a {existing.Type} model, not a {model.Type} model.");
        }

        if (!await _modelService.UpdateModelAsync(model))
        {
            return ApiErrors.NotFound(ErrorCodes.ModelNotFound, $"Model with id {model.Id} not found.");
        }

        RecordChange("updated", existing, model);
        return Ok(ModelDtoMapper.ToDto(model));
    }

    private static ErrorCode? ValidateLanguageModel(SaveLanguageModelDto dto)
    {
        if (!IsValidScheme(dto.Capabilities.TokenCountingScheme))
        {
            return ErrorCodes.ModelTokenSchemeUnknown with { Message = $"Unknown token counting scheme '{dto.Capabilities.TokenCountingScheme}'." };
        }

        if (!Enum.IsDefined(dto.ApiProtocol))
        {
            return ErrorCodes.ModelApiProtocolUnknown with { Message = $"Unknown API protocol '{dto.ApiProtocol}'." };
        }

        if (!Enum.IsDefined(dto.Classification))
        {
            return ErrorCodes.ModelClassificationUnknown with { Message = $"Unknown data classification '{dto.Classification}'." };
        }

        return null;
    }

    private static ErrorCode? ValidateImageModel(SaveImageModelDto dto)
    {
        var capabilities = dto.Capabilities;
        if (!Enum.IsDefined(dto.ImageApi))
        {
            return ErrorCodes.ModelImageApiUnknown with { Message = $"Unknown image API '{dto.ImageApi}'." };
        }

        if (capabilities.MaxImagesPerRequest < 1)
        {
            return ErrorCodes.ModelImagesPerRequestTooLow;
        }

        if (capabilities.OutputFormats.Count == 0)
        {
            return ErrorCodes.ModelOutputFormatMissing;
        }

        if (capabilities.SizePresets.Count == 0 && !capabilities.SupportsAutoSize && !capabilities.SupportsCustomSize)
        {
            return ErrorCodes.ModelSizeMissing;
        }

        if (capabilities.SizePresets.Any(s => s.Width <= 0 || s.Height <= 0))
        {
            return ErrorCodes.ModelSizePresetInvalid;
        }

        if (capabilities.MaxPartialImages < 0)
        {
            return ErrorCodes.ModelPartialImagesNegative;
        }

        if (capabilities.Editing is { } editing && (editing.MaxInputImages < 1 || editing.InputFormats.Count == 0))
        {
            return ErrorCodes.ModelEditingInputsMissing;
        }

        return null;
    }

    private static LanguageModel ToLanguageModel(SaveLanguageModelDto dto, string id) => new()
    {
        Id = id,
        ModelId = dto.ModelId,
        ModelName = dto.ModelName,
        Description = dto.Description,
        EndpointId = dto.EndpointId,
        AllowedRoles = dto.AllowedRoles,
        AllowedAsDefault = dto.AllowedAsDefault,
        ExposedInApi = dto.ExposedInApi,
        ApiProtocol = dto.ApiProtocol,
        Classification = dto.Classification,
        Capabilities = ToCapabilities(dto.Capabilities)
    };

    private static ImageModel ToImageModel(SaveImageModelDto dto, string id) => new()
    {
        Id = id,
        ModelId = dto.ModelId,
        ModelName = dto.ModelName,
        Description = dto.Description,
        EndpointId = dto.EndpointId,
        AllowedRoles = dto.AllowedRoles,
        ImageApi = dto.ImageApi,
        Capabilities = ModelDtoMapper.ToCapabilities(dto.Capabilities)
    };

    private static LanguageModelCapabilities ToCapabilities(LanguageModelCapabilitiesDto dto) => new()
    {
        SupportsVision = dto.SupportsVision,
        SupportsFunctionCalling = dto.SupportsFunctionCalling,
        Temperature = dto.Temperature,
        SupportedEfforts = NormalizeEfforts(dto.SupportedEfforts),
        MaxContextTokens = dto.MaxContextTokens,
        MaxOutputTokens = dto.MaxOutputTokens,
        // A model that never emits output is a misconfiguration, and Anthropic requires
        // max_tokens on every request — fall back to the ceiling rather than storing 0.
        DefaultMaxOutputTokens = dto.DefaultMaxOutputTokens > 0 ? dto.DefaultMaxOutputTokens : dto.MaxOutputTokens,
        KnowledgeCutoff = dto.KnowledgeCutoff,
        TokenCountingScheme = TokenCountingSchemes.Normalize(dto.TokenCountingScheme)
    };

    // No scheme, or a known scheme that is not the text-only variant.
    private static bool IsValidScheme(string? scheme) =>
        TokenCountingSchemes.Normalize(scheme) == null ||
        (TokenCountingSchemes.TryParse(scheme, out var parsed) && parsed.CountsImages);

    // Stored ascending and deduplicated so LowestEffort and the client's slider can both
    // rely on the order without re-sorting.
    private static List<ReasoningEffort> NormalizeEfforts(List<ReasoningEffort>? efforts) =>
        efforts == null ? new List<ReasoningEffort>() : efforts.Distinct().OrderBy(e => e).ToList();
}
