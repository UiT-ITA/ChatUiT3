namespace ChatUitReact.Server.Models;

public class UserPreferences
{
    public string UserId { get; set; } = string.Empty;
    public string Theme { get; set; } = "light";
    public string Language { get; set; } = "en-US";
    public NotificationSettings Notifications { get; set; } = new NotificationSettings();
    public DisplaySettings Display { get; set; } = new DisplaySettings();
}

public class NotificationSettings
{
    public bool EnableEmailNotifications { get; set; } = true;
    public bool EnablePushNotifications { get; set; } = true;
    public Dictionary<string, bool> DismissedNotifications { get; set; } = new Dictionary<string, bool>();
}

public class DisplaySettings
{
    public bool CompactMode { get; set; } = false;
    public int FontSize { get; set; } = 14;
    public bool ShowTimestamps { get; set; } = true;
}
