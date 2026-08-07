using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public class SettingsService : ISettingsService
{
    private readonly IDatabaseService _databaseService;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private AppSettings _settings = new();
    private bool _isInitialized = false;

    public SettingsService(IDatabaseService databaseService)
    {
        _databaseService = databaseService;
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

    public async Task UpdateAppSettingsAsync(AppSettings settings)
    {
        await EnsureInitializedAsync();
        await _databaseService.UpdateAppSettingsAsync(settings);
        _settings = settings;
    }
}
