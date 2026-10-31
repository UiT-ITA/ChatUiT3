using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services;

public class SettingsService : ISettingsService
{
    private readonly IDatabaseService _databaseService;
    private readonly IModelService _modelService;
    private readonly ILogger<SettingsService> _logger;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private AppSettings _settings = new();
    private bool _isInitialized = false;

    public SettingsService(IDatabaseService databaseService, IModelService modelService, ILogger<SettingsService> logger)
    {
        _databaseService = databaseService;
        _modelService = modelService;
        _logger = logger;
    }

    private async Task EnsureInitializedAsync()
    {
        if (_isInitialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_isInitialized) return;

            _settings = await _databaseService.GetAppSettingsAsync();
            _isInitialized = true;

            _logger.LogInformation(
                "Loaded app settings. DefaultModelId='{DefaultModelId}', ChatNamingModelId='{ChatNamingModelId}', DefaultAssistantId='{DefaultAssistantId}'",
                _settings.DefaultModelId,
                _settings.ChatNamingModelId,
                _settings.DefaultAssistantId);
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task<AppSettings> GetAppSettingsAsync()
    {
        await EnsureInitializedAsync();
        return _settings;
    }

    public async Task<AppSettings> GetEffectiveAppSettingsAsync()
    {
        var stored = await GetAppSettingsAsync();

        var defaultModelId = await ResolveOrFallbackAsync(stored.DefaultModelId, nameof(AppSettings.DefaultModelId));
        var chatNamingModelId = await ResolveOrFallbackAsync(stored.ChatNamingModelId, nameof(AppSettings.ChatNamingModelId));

        return new AppSettings
        {
            DefaultModelId = defaultModelId,
            ChatNamingModelId = chatNamingModelId,
            // Passed through as stored: an assistant id cannot be resolved against the model
            // registry, and the client's own resolution chain already falls back when it dangles.
            DefaultAssistantId = stored.DefaultAssistantId
        };
    }

    public async Task UpdateAppSettingsAsync(AppSettings settings)
    {
        await EnsureInitializedAsync();
        await _databaseService.UpdateAppSettingsAsync(settings);
        _settings = settings;

        _logger.LogInformation(
            "Saved app settings. DefaultModelId='{DefaultModelId}', ChatNamingModelId='{ChatNamingModelId}', DefaultAssistantId='{DefaultAssistantId}'",
            settings.DefaultModelId,
            settings.ChatNamingModelId,
            settings.DefaultAssistantId);
    }

    // Keeps the stored id when it still resolves to a model, otherwise falls back to the
    // first registered model so the app never silently does nothing.
    private async Task<string> ResolveOrFallbackAsync(string storedModelId, string settingName)
    {
        if (!string.IsNullOrWhiteSpace(storedModelId) && await _modelService.GetModelAsync<LanguageModel>(storedModelId) != null)
        {
            return storedModelId;
        }

        var fallback = await GetFallbackModelIdAsync();

        if (fallback == null)
        {
            _logger.LogWarning("{SettingName} is not set and no models are registered.", settingName);
            return string.Empty;
        }

        _logger.LogWarning(
            "{SettingName} ('{StoredModelId}') is not set or no longer resolves. Falling back to model {FallbackModelId}.",
            settingName,
            storedModelId,
            fallback);

        return fallback;
    }

    private async Task<string?> GetFallbackModelIdAsync()
    {
        var models = await _modelService.GetModelsAsync<LanguageModel>();

        // Ordered by name so the fallback is stable across restarts
        return models
            .OrderBy(m => m.ModelName, StringComparer.OrdinalIgnoreCase)
            .Select(m => m.Id)
            .FirstOrDefault();
    }
}
