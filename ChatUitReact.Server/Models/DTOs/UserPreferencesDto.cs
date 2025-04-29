namespace ChatUitReact.Server.Models.DTOs;

public class UserPreferencesDto
{
    public string Theme { get; set; } = "light";
    public string Language { get; set; } = "en-US";
    public NotificationSettingsDto Notifications { get; set; } = new NotificationSettingsDto();
    public DisplaySettingsDto Display { get; set; } = new DisplaySettingsDto();
}

public class NotificationSettingsDto
{
    public bool EnableEmailNotifications { get; set; } = true;
    public bool EnablePushNotifications { get; set; } = true;
    public Dictionary<string, bool> DismissedNotifications { get; set; } = new Dictionary<string, bool>();
}

public class DisplaySettingsDto
{
    public bool CompactMode { get; set; } = false;
    public int FontSize { get; set; } = 14;
    public bool ShowTimestamps { get; set; } = true;
}
