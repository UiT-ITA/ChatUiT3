using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.MediaGenerations;

namespace ChatUiT.Server.Controllers;

/// <summary>
/// The user's generations with image models (and later voice models). A generation runs in
/// the background; its events arrive over the hub and its outputs are downloaded here.
/// </summary>
[ApiController]
[Route("api/media-generations")]
[Authorize]
public class MediaGenerationsController : ControllerBase
{
    /// <summary>A mask or a markup image beside the input images.</summary>
    private const int MaxOverlayImages = 2;

    /// <summary>Room for the request JSON and the multipart framing.</summary>
    private const long FormOverheadBytes = 1024 * 1024;

    private readonly MediaGenerationService _generations;
    private readonly ImagePromptRefiner _promptRefiner;
    private readonly IMediaGenerationStore _store;
    private readonly IModelService _modelService;
    private readonly IAiProviderRegistry _providers;
    private readonly UserService _userService;
    private readonly ILogger<MediaGenerationsController> _logger;

    public MediaGenerationsController(
        MediaGenerationService generations,
        ImagePromptRefiner promptRefiner,
        IMediaGenerationStore store,
        IModelService modelService,
        IAiProviderRegistry providers,
        UserService userService,
        ILogger<MediaGenerationsController> logger)
    {
        _generations = generations;
        _promptRefiner = promptRefiner;
        _store = store;
        _modelService = modelService;
        _providers = providers;
        _userService = userService;
        _logger = logger;
    }

    /// <summary>The image models the caller's roles allow.</summary>
    [HttpGet("image-models")]
    public async Task<ActionResult<List<UserImageModelDto>>> GetImageModels()
    {
        var models = await _modelService.GetModelsForUserAsync<ImageModel>(_userService.GetUserRoles(User));
        return Ok(models
            .OrderBy(m => m.ModelName, StringComparer.OrdinalIgnoreCase)
            .Select(m => new UserImageModelDto
            {
                Id = m.Id,
                ModelName = m.ModelName,
                Description = m.Description,
                Capabilities = ModelDtoMapper.ToDto(m.Capabilities)
            })
            .ToList());
    }

    [HttpGet]
    public ActionResult<List<MediaGenerationDto>> GetGenerations()
    {
        return Ok(_store.List(_userService.GetCurrentUserId(User)).Select(MediaGenerationDto.From).ToList());
    }

    [HttpGet("{id}")]
    public ActionResult<MediaGenerationDto> GetGeneration(string id)
    {
        var generation = _store.Get(_userService.GetCurrentUserId(User), id);
        return generation == null ? NotFound() : Ok(MediaGenerationDto.From(generation));
    }

    [HttpGet("{id}/outputs/{outputId}")]
    public IActionResult GetOutput(string id, string outputId)
    {
        var output = _store.Get(_userService.GetCurrentUserId(User), id)?.FindOutput(outputId);
        return output == null ? NotFound() : File(output.Content, output.MediaType);
    }

    /// <summary>Rewrites a prompt for an image model with the default language model.</summary>
    [HttpPost("image-models/{modelId}/refine-prompt")]
    public async Task<ActionResult<RefineImagePromptResultDto>> RefineImagePrompt(string modelId, [FromBody] RefineImagePromptRequestDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Prompt))
        {
            return BadRequest("A prompt is required.");
        }

        var model = await _modelService.GetModelForUserAsync<ImageModel>(modelId, _userService.GetUserRoles(User));
        if (model == null)
        {
            return NotFound("The image model does not exist or is not available to you.");
        }

        try
        {
            var prompt = await _promptRefiner.RefineAsync(model, dto.Prompt, dto.IsEdit, cancellationToken);
            return Ok(new RefineImagePromptResultDto { Prompt = prompt });
        }
        catch (ImagePromptRefinementException ex)
        {
            return UnprocessableEntity(ex.Message);
        }
    }

    /// <summary>
    /// Starts an image generation on <paramref name="modelId"/>, or an edit when input images are
    /// sent. The form holds an <see cref="ImageGenerationRequestDto"/> as JSON in <c>request</c> and
    /// the files in <c>inputImages</c>, <c>mask</c> and <c>markup</c>. The body may be as large as
    /// the model's input limits allow.
    /// </summary>
    [HttpPost("image-models/{modelId}/generations")]
    [Consumes("multipart/form-data")]
    [DisableFormValueModelBinding]
    public async Task<ActionResult<MediaGenerationDto>> StartImageGeneration(string modelId, CancellationToken cancellationToken)
    {
        if (await _modelService.GetModelForUserAsync<ImageModel>(modelId, _userService.GetUserRoles(User)) == null)
        {
            return NotFound("The image model does not exist or is not available to you.");
        }

        var resolved = await _modelService.GetModelWithEndpointAsync<ImageModel>(modelId);
        if (resolved is not var (endpoint, model) || !_providers.Supports(endpoint.EndpointType))
        {
            return BadRequest("The image model's endpoint is missing or not supported.");
        }

        var form = await ReadFormAsync(model.Capabilities, cancellationToken);
        if (form == null)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, "The images are larger than the model accepts.");
        }

        ImageGenerationRequestDto? dto;
        try
        {
            dto = JsonSerializer.Deserialize<ImageGenerationRequestDto>(form["request"].ToString(), JsonSerializerOptions.Web);
        }
        catch (JsonException)
        {
            return BadRequest("The request is not valid JSON.");
        }

        if (dto == null)
        {
            return BadRequest("The request is empty.");
        }

        var inputImages = form.Files.GetFiles("inputImages");
        var mask = form.Files.GetFile("mask");
        var markup = form.Files.GetFile("markup");

        var images = new List<ImageInput>();
        foreach (var file in inputImages)
        {
            if (await ReadImageAsync(file) is not { } image)
            {
                return BadRequest($"{file.FileName} is not a PNG, JPEG or WebP image.");
            }

            images.Add(image);
        }

        ImageInput? maskImage = null;
        if (mask != null && (maskImage = await ReadImageAsync(mask)) == null)
        {
            return BadRequest($"{mask.FileName} is not a PNG, JPEG or WebP image.");
        }

        ImageInput? markupImage = null;
        if (markup != null && (markupImage = await ReadImageAsync(markup)) == null)
        {
            return BadRequest($"{markup.FileName} is not a PNG, JPEG or WebP image.");
        }

        var parameters = new ImageGenerationParameters
        {
            Prompt = dto.Prompt.Trim(),
            Size = dto.Size == null ? null : new ImageSize(dto.Size.Width, dto.Size.Height),
            AutoAspectRatio = dto.AutoAspectRatio,
            Quality = dto.Quality,
            Count = dto.Count,
            OutputFormat = dto.OutputFormat,
            Compression = dto.Compression,
            Background = dto.Background,
            Moderation = dto.Moderation,
            PartialImages = dto.PartialImages,
            WebGrounding = dto.WebGrounding,
            InputImages = images,
            Mask = maskImage,
            Markup = markupImage
        };

        var problems = ImageParameterValidator.Validate(model.Capabilities, parameters);
        if (problems.Count > 0)
        {
            return BadRequest(string.Join(" ", problems));
        }

        var generation = _generations.StartImageGeneration(
            _userService.GetCurrentUserId(User),
            new ImageRequest { Model = model, Endpoint = endpoint, Parameters = parameters });

        _logger.LogInformation("Started image generation {GenerationId} on model {ModelId}", generation.Id, model.Id);
        return Accepted(MediaGenerationDto.From(generation));
    }

    [HttpPost("{id}/cancel")]
    public IActionResult CancelGeneration(string id)
    {
        return _generations.TryCancel(_userService.GetCurrentUserId(User), id) ? NoContent() : NotFound();
    }

    /// <summary>
    /// The request's form, read with a body limit of what the model accepts: its input images and
    /// a mask or markup at the largest input size. Null when the body is larger. A model without
    /// an input size limit keeps the server's limit.
    /// </summary>
    private async Task<IFormCollection?> ReadFormAsync(ImageModelCapabilities capabilities, CancellationToken cancellationToken)
    {
        var options = new FormOptions();
        if (capabilities.Editing is not { } editing)
        {
            options.MultipartBodyLengthLimit = FormOverheadBytes;
            SetBodyLimit(FormOverheadBytes);
        }
        else if (editing.MaxInputImageBytes is { } maxImageBytes)
        {
            var limit = (editing.MaxInputImages + MaxOverlayImages) * maxImageBytes + FormOverheadBytes;
            options.MultipartBodyLengthLimit = limit;
            SetBodyLimit(limit);
        }

        try
        {
            return await Request.ReadFormAsync(options, cancellationToken);
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return null;
        }
        catch (InvalidDataException)
        {
            return null;
        }
    }

    private void SetBodyLimit(long bytes)
    {
        if (HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } bodySize)
        {
            bodySize.MaxRequestBodySize = bytes;
        }
    }

    /// <summary>The file as an image input, or null when it is not a PNG, JPEG or WebP.</summary>
    private static async Task<ImageInput?> ReadImageAsync(IFormFile file)
    {
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        var content = buffer.ToArray();
        return DetectFormat(content) is { } format ? new ImageInput(content, format, file.FileName) : null;
    }

    private static ImageFormat? DetectFormat(ReadOnlySpan<byte> content)
    {
        if (content.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return ImageFormat.Png;
        }

        if (content.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF }))
        {
            return ImageFormat.Jpeg;
        }

        if (content.Length >= 12 && content[..4].SequenceEqual("RIFF"u8) && content.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            return ImageFormat.Webp;
        }

        return null;
    }
}
