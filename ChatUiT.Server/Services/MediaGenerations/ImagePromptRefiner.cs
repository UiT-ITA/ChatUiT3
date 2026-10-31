namespace ChatUiT.Server.Services.MediaGenerations;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.TokenCounting;

/// <summary>
/// Rewrites a user's image prompt into a fuller one with the default language model from the
/// app settings.
/// </summary>
public sealed class ImagePromptRefiner
{
    private readonly ISettingsService _settingsService;
    private readonly IModelService _modelService;
    private readonly IAiProviderRegistry _providers;
    private readonly ITokenCountingService _tokenCounting;
    private readonly ILogger<ImagePromptRefiner> _logger;

    public ImagePromptRefiner(
        ISettingsService settingsService,
        IModelService modelService,
        IAiProviderRegistry providers,
        ITokenCountingService tokenCounting,
        ILogger<ImagePromptRefiner> logger)
    {
        _settingsService = settingsService;
        _modelService = modelService;
        _providers = providers;
        _tokenCounting = tokenCounting;
        _logger = logger;
    }

    /// <summary>
    /// The refined prompt for <paramref name="imageModel"/>. <paramref name="isEdit"/> means the
    /// prompt describes changes to input images.
    /// </summary>
    /// <exception cref="ImagePromptRefinementException">
    /// No default model is usable, the prompt does not fit its context, or the model failed or returned no text.
    /// </exception>
    public async Task<string> RefineAsync(ImageModel imageModel, string prompt, bool isEdit, CancellationToken cancellationToken)
    {
        var settings = await _settingsService.GetEffectiveAppSettingsAsync();
        var resolved = string.IsNullOrWhiteSpace(settings.DefaultModelId)
            ? null
            : await _modelService.GetModelWithEndpointAsync<LanguageModel>(settings.DefaultModelId);
        if (resolved is not var (endpoint, model) || !_providers.Supports(endpoint.EndpointType))
        {
            throw new ImagePromptRefinementException("No default model is set up to refine prompts.");
        }

        var instructions = Instructions(imageModel, isEdit);
        var message = new ChatMessage { Role = AiChatRole.User, Content = prompt };
        var parameters = ChatParameterResolver.Resolve(model.Capabilities, new ChatSettings
        {
            Model = model,
            ReasoningEffort = ReasoningEffort.None
        });

        // Models without a token counter are left to the model's own context check
        if (TokenCountingSchemes.IdFor(model.Capabilities) is { } schemeId)
        {
            var inputTokens = _tokenCounting.CountSystemPrompt(instructions, [], schemeId) + _tokenCounting.CountMessage(message, schemeId);
            if (inputTokens + parameters.MaxOutputTokens > model.Capabilities.MaxContextTokens)
            {
                throw new ImagePromptRefinementException("The prompt is too long to refine.");
            }
        }

        var request = new AiRequest
        {
            Model = model,
            Endpoint = endpoint,
            SystemPrompt = instructions,
            Messages = AiInputItem.From(new List<ChatMessage> { message }),
            Parameters = parameters
        };

        string refined;
        try
        {
            refined = await _providers.For(endpoint.EndpointType).CompleteTextAsync(request, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Refining a prompt with model {ModelId} failed.", model.Id);
            throw new ImagePromptRefinementException("The model could not refine the prompt.");
        }

        if (refined.Length == 0)
        {
            throw new ImagePromptRefinementException("The model returned no prompt.");
        }

        return refined;
    }

    private static string Instructions(ImageModel imageModel, bool isEdit)
    {
        var task = isEdit
            ? "The user's text tells an image model how to change one or more images the user has supplied. You cannot see those images. "
            : "The user's text asks an image model to create an image. ";
        var limit = imageModel.Capabilities.MaxPromptCharacters is { } max
            ? $"The prompt must be at most {max} characters. "
            : string.Empty;

        return
            "You rewrite prompts for the image model " + imageModel.ModelName + ". " + task +
            "Rewrite the text into a clear, specific prompt that gets the best result from the image model. " +
            "Keep everything the user asked for and keep their intent. Add detail on subject, composition, style, " +
            "lighting and colour only where the user left it open, and never change what they stated. " +
            "Write the prompt in the language the user wrote in. " + limit +
            "Reply with the prompt only: no introduction, no explanation, no quotes and no formatting.";
    }
}

/// <summary>The prompt could not be refined. The message is safe to show.</summary>
public sealed class ImagePromptRefinementException : Exception
{
    public ImagePromptRefinementException(string message) : base(message)
    {
    }
}
