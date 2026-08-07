using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    private AppSettings _appSettings = new AppSettings();

    public Task<AppSettings> GetAppSettingsAsync()
    {
        return Task.FromResult(new AppSettings
        {
            DefaultModelId = _appSettings.DefaultModelId,
            ChatNamingModelId = _appSettings.ChatNamingModelId
        });
    }

    public Task UpdateAppSettingsAsync(AppSettings settings)
    {
        _appSettings = new AppSettings
        {
            DefaultModelId = settings.DefaultModelId,
            ChatNamingModelId = settings.ChatNamingModelId
        };
        return Task.CompletedTask;
    }
}
