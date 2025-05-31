using ChatUitReact.Server.Models;
using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Hubs
{
    public partial class ChatHub
    {
        public async Task GetUserAssistants()
        {
            var userId = GetCurrentUserId();
            var result = await _assistantService.GetUserAssistantsAsync(userId);

            var assistants = new AssistantListDto
            {
                Owned = result.Owned.Select(assistant => new PrivateAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    Model = assistant.Model,
                    SystemPrompt = assistant.ChatSettings.SystemPrompt,
                    Temperature = assistant.ChatSettings.Temperature,
                    ReasoningEffort = assistant.ChatSettings.ReasoningEffort,
                    IsVisible = true
                }).ToList(),

                System = result.System.Select(assistant => new SystemAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    ModelName = assistant.Model.ModelName,
                    IsVisible = true
                }).ToList(),

                Shared = result.Shared.Select(assistant => new SharedAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    ModelName = assistant.Model.ModelName,
                    IsVisible = true
                }).ToList()
            };

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
