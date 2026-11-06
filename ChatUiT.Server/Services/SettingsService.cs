using ChatUiT.Server.Models;
using ChatUiT.Server.Telemetry;

namespace ChatUiT.Server.Services;

public class SettingsService : ISettingsService
{
    private readonly IDatabaseService _databaseService;
    private readonly IModelService _modelService;
    private readonly AppTelemetry _telemetry;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private AppSettings _settings = new();
    private bool _isInitialized = false;

    public SettingsService(IDatabaseService databaseService, IModelService modelService, AppTelemetry telemetry)
    {
        _databaseService = databaseService;
        _modelService = modelService;
        _telemetry = telemetry;
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
        var before = _settings;
        await _databaseService.UpdateAppSettingsAsync(settings);
        _settings = settings;

        var diff = TelemetryDiff.Compute(before, settings);
        _telemetry.AdminChanged("settings", "app", "updated", diff.Changed, diff.Changes);
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
            _telemetry.SettingModelFallback(settingName, storedModelId, null);
            return string.Empty;
        }

        _telemetry.SettingModelFallback(settingName, storedModelId, fallback);

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
