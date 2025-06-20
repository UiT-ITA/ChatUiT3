using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services
{
    public interface IAssistantService
    {
        Task<UserAssistantsResult> GetUserAssistantsAsync(string userId);
        Task<Assistant?> GetAssistantByIdAsync(string assistantId, string userId);
        Task<bool> CreateAssistantAsync(CreateAssistantDto createDto, string userId);
        Task<bool> UpdateAssistantAsync(UpdateAssistantDto updateDto, string userId);
        Task<bool> DeleteAssistantAsync(string assistantId, string userId);
    Task<bool> AddSharedAssistantAsync(string assistantId, string userId);
    Task<bool> ToggleAssistantVisibilityAsync(string assistantId, string userId);
    Task<string> GenerateShareLinkAsync(string assistantId, string userId);
    Task<AssistantListDto> GetUserAssistantsDtoAsync(string userId);
    }
}
