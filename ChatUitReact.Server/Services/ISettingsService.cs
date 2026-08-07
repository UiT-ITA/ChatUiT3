using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface ISettingsService
{
    Task<AppSettings> GetAppSettingsAsync();
    Task UpdateAppSettingsAsync(AppSettings settings);
}
