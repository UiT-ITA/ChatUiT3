using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;

namespace ChatUitReact.Server.Services;
public interface IAssistantService
{
    Task<UserAssistantsResult> GetUserAssistantsAsync(string userId, UserAccess access);
    Task<Assistant?> GetAssistantByIdAsync(string assistantId, bool includeFileContent = false);
    Task<AssistantFileDto?> GetAssistantFileDtoAsync(string assistantId, string fileId);
    Task<bool> CreateAssistantAsync(CreateAssistantDto createDto, string userId);
    Task<bool> UpdateAssistantAsync(UpdateAssistantDto updateDto, string userId);
    Task<bool> DeleteAssistantAsync(string assistantId, string userId);
    /// <exception cref="SharedAssistantRefusedException">The assistant carries tools the user may not use.</exception>
    Task<bool> AddSharedAssistantAsync(string assistantId, string userId, UserAccess access);
    /// <summary>Display names of the assistant's tools this user may not use.</summary>
    Task<IReadOnlyList<string>> DisallowedToolNamesAsync(Assistant assistant, UserAccess access);
    /// <summary>The lowest classification of the assistant's model and the tools of its selected toolboxes.</summary>
    DataClassification ClassificationOf(Assistant assistant);
    /// <summary>Whether the assistant is in the user's list: owned, a system assistant they may use, or shared with them.</summary>
    Task<bool> IsInUserListAsync(Assistant assistant, string userId, UserAccess access);
    Task<bool> RemoveSharedAssistantAsync(string assistantId, string userId);
    Task<bool> ToggleAssistantVisibilityAsync(string assistantId, string userId);
    Task<bool> SetDefaultAssistantAsync(string assistantId, string userId, List<UserRole> roles);
    Task<bool> ClearDefaultAssistantAsync(string userId);
    Task<bool> ToggleAssistantFavoriteAsync(string assistantId, string userId);
    Task<string> GenerateShareLinkAsync(string assistantId, string userId);
    Task<AssistantListDto> GetUserAssistantsDtoAsync(UserIdentity identity, UserAccess access);
    /// <summary>The user facts prompt snippets may read, from the stored profile with claims as fallback.</summary>
    Task<PromptUserContext> GetPromptUserContextAsync(UserIdentity identity);
    Task<List<FullAssistantDto>> GetSystemAssistantsForAdminAsync();
    Task<FullAssistantDto?> GetSystemAssistantForAdminAsync(string assistantId);
    Task<FullAssistantDto> CreateSystemAssistantAsync(CreateAssistantDto createDto);
    Task<FullAssistantDto?> UpdateSystemAssistantAsync(string assistantId, UpdateAssistantDto updateDto);
    Task<bool> DeleteSystemAssistantAsync(string assistantId);
}
