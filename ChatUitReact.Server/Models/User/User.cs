using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class UserInfo
{
    public string Username { get; set; } = string.Empty;
    public List<UserRole> Roles { get; set; } = new List<UserRole>();
    public UserPreferences Preferences { get; set; } = new UserPreferences();
}

public class UserPreferences
{
    public NotificationSettings Notifications { get; set; } = new NotificationSettings();
    public DisplaySettings Display { get; set; } = new DisplaySettings();
    public List<string> SharedAssistantIds { get; set; } = new List<string>();
    public List<string> FavoritedAssistantIds { get; set; } = new List<string>();
    public List<string> VisibleAssistantIds { get; set; } = new List<string>();
}

public class NotificationSettings
{
    // Will be used later for push notifications
    public Dictionary<string, bool> DismissedNotifications { get; set; } = new Dictionary<string, bool>();
}

public class DisplaySettings
{
    public string Theme { get; set; } = "dark";
    public string Language { get; set; } = "en-US";
    public bool CompactMode { get; set; } = false;
    public int FontSize { get; set; } = 14;
}
