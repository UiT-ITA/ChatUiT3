using ChatUitReact.Server.Models;
using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Hubs
{
    public partial class ChatHub
    {
        public async Task GetUserAssistants()
        {
            var userId = GetCurrentUserId();
            var assistants = await _assistantService.GetUserAssistantsDtoAsync(userId);
            await Clients.Caller.UserAssistants(assistants);
        }

        public async Task CreateAssistant(CreateAssistantDto createDto)
        {
            _logger.LogInformation("Creating assistant for user {UserId}", GetCurrentUserId());
            var userId = GetCurrentUserId();
            await _assistantService.CreateAssistantAsync(createDto, userId);
        }

        public async Task UpdateAssistant(UpdateAssistantDto updateDto)
        {
            var userId = GetCurrentUserId();
            await _assistantService.UpdateAssistantAsync(updateDto, userId);
        }

        public async Task DeleteAssistant(string assistantId)
        {
            var userId = GetCurrentUserId();
            await _assistantService.DeleteAssistantAsync(assistantId, userId);
        }

        public async Task AddSharedAssistant(string assistantId)
        {
            var userId = GetCurrentUserId();
            await _assistantService.AddSharedAssistantAsync(assistantId, userId);
        }

        public async Task ToggleAssistantVisibility(string assistantId)
        {
            var userId = GetCurrentUserId();
            await _assistantService.ToggleAssistantVisibilityAsync(assistantId, userId);
        }

        public async Task<string> GenerateShareLink(string assistantId)
        {
            var userId = GetCurrentUserId();
            return await _assistantService.GenerateShareLinkAsync(assistantId, userId);
        }
    }
}
