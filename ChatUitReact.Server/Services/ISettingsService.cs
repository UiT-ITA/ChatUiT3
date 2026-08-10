using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface ISettingsService
{
    // Exactly what is stored, empty ids included
    Task<AppSettings> GetAppSettingsAsync();

    // Stored settings with any unset or no longer resolvable model id replaced by a fallback model
    Task<AppSettings> GetEffectiveAppSettingsAsync();

    Task UpdateAppSettingsAsync(AppSettings settings);
}
