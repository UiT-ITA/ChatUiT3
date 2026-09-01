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
    public List<string> HiddenAssistantIds { get; set; } = new List<string>();

    /// <summary>
    /// The assistant the user pinned for new chats, or null when they have not pinned one.
    /// Kept as stored even when it stops being usable: eligibility is re-checked on every read
    /// (the assistant may be deleted, its model removed, or its model may no longer be
    /// default-eligible), so a pin that stops resolving starts working again by itself if the
    /// assistant's model is switched back. Nothing cascades into this field when someone else
    /// edits a shared or system assistant.
    /// </summary>
    public string? DefaultAssistantId { get; set; }
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
