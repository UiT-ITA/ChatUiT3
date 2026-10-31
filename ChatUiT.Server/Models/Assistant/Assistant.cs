using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Models;

public class Assistant
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    public ChatSettings ChatSettings { get; set; } = new ChatSettings();
    public List<AssistantFile> Files { get; set; } = new List<AssistantFile>();

    /// <summary>Knowledge sources loaded at send time and carried like knowledge files. See <c>IKnowledgeSource</c>.</summary>
    public List<string> KnowledgeSourceIds { get; set; } = new List<string>();
    internal string OwnerId { get; set; } = string.Empty;
    /// <summary>Last write. Cache key for derived per-assistant values such as prompt token counts.</summary>
    public DateTime UpdatedAt { get; set; }

    /// <summary>System assistants only: who may see and use it. Null means everyone.</summary>
    public AssistantAccessPolicy? Access { get; set; }

    public const string SystemOwnerId = "System";

    public bool IsSystem => OwnerId == SystemOwnerId;
}

/// <summary>
/// Who may use a system assistant: any listed role or any listed Entra group. Tool policies are
/// not enforced on system assistants, so this is what decides who reaches their tools.
/// </summary>
public sealed class AssistantAccessPolicy
{
    public List<UserRole> AllowedRoles { get; set; } = new();

    public List<string> AllowedGroupIds { get; set; } = new();

    public bool Allows(UserAccess access)
        => AllowedRoles.Any(access.Roles.Contains)
           || AllowedGroupIds.Any(id => access.GroupIds.Contains(id, StringComparer.OrdinalIgnoreCase));
}

public static class AssistantFileCategories
{
    public const string AlwaysLoaded = "alwaysLoaded";
    public const string SelectiveLoaded = "selectiveLoaded";
    public const string RagLoaded = "ragLoaded";
}

/// <summary>How many tokens the always-loaded files of an assistant may use together. Mirrored on the client.</summary>
public static class AlwaysLoadedFileLimit
{
    public const int MaxTokens = 100_000;

    /// <summary>Half the model's context window, never more than <see cref="MaxTokens"/>.</summary>
    public static int For(LanguageModelCapabilities capabilities) => Math.Min(capabilities.MaxContextTokens / 2, MaxTokens);
}

public class AssistantFile : ChatFile
{
    public string Category { get; set; } = AssistantFileCategories.AlwaysLoaded;
    public string? Description { get; set; }
}

public class UserAssistantsResult
{
    public List<Assistant> Owned { get; set; } = new();
    public List<Assistant> System { get; set; } = new();
    public List<Assistant> Shared { get; set; } = new();
}
