using ChatUitReact.Server.Models;
using ChatUitReact.Server.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Services
{
    public class AssistantService : IAssistantService
    {
        private readonly IDatabaseService _databaseService;
        private readonly IModelService _modelService;
        private readonly IHubContext<ChatHub> _hubContext;

        public AssistantService(IDatabaseService databaseService, IModelService modelService, IHubContext<ChatHub> hubContext)
        {
            _databaseService = databaseService;
            _modelService = modelService;
            _hubContext = hubContext;
        }

        public async Task<UserAssistantsResult> GetUserAssistantsAsync(string userId)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return new UserAssistantsResult();

            var ownedAssistants = await _databaseService.GetAssistantsByOwnerAsync(userId);
            var systemAssistants = await _databaseService.GetSystemAssistantsAsync();
            var sharedAssistants = await _databaseService.GetAssistantsByIdsAsync(user.Preferences.SharedAssistantIds);

            return new UserAssistantsResult
            {
                Owned = ownedAssistants,
                System = systemAssistants,
                Shared = sharedAssistants
            };
        }

        public async Task<Assistant?> GetAssistantByIdAsync(string assistantId, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null) return null;

            if (assistant.OwnerId != userId && assistant.OwnerId != "System")
            {
                return null;
            }

            return assistant;
        }

        public async Task<bool> CreateAssistantAsync(CreateAssistantDto createDto, string userId)
        {
            var model = await _modelService.GetModelByIdAsync(createDto.ModelId);
            if (model == null)
            {
                throw new ArgumentException("Invalid model ID", nameof(createDto.ModelId));
            }

            var assistant = new Assistant
            {
                Name = createDto.Name,
                Description = createDto.Description,
                Tags = createDto.Tags,
                Model = model,
                ChatSettings = new ChatSettings
                {
                    SystemPrompt = createDto.SystemPrompt,
                    Temperature = createDto.Temperature,
                    ReasoningEffort = createDto.ReasoningEffort,
                    Model = model
                },
                OwnerId = userId
            };

            var createdAssistant = await _databaseService.CreateAssistantAsync(assistant);
            
            var user = await _databaseService.GetUserAsync(userId);
            if (user != null && !user.Preferences.VisibleAssistantIds.Contains(createdAssistant.Id))
            {
                user.Preferences.VisibleAssistantIds.Add(createdAssistant.Id);
                await _databaseService.UpdateUserAsync(user);
            }

            await NotifyAssistantsUpdated(userId);
            
            return true;
        }

        public async Task<bool> UpdateAssistantAsync(UpdateAssistantDto updateDto, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(updateDto.Id);
            if (assistant == null || assistant.OwnerId != userId) return false;

            var model = await _modelService.GetModelByIdAsync(updateDto.ModelId);
            if (model == null) return false;

            assistant.Name = updateDto.Name;
            assistant.Description = updateDto.Description;
            assistant.Tags = updateDto.Tags;
            assistant.Model = model;
            assistant.ChatSettings = new ChatSettings
            {
                SystemPrompt = updateDto.SystemPrompt,
                Temperature = updateDto.Temperature,
                ReasoningEffort = updateDto.ReasoningEffort,
                Model = model
            };

            var updatedAssistant = await _databaseService.UpdateAssistantAsync(assistant);
            if (updatedAssistant == null) return false;

            await NotifyAssistantsUpdated(userId);

            return true;
        }

        public async Task<bool> DeleteAssistantAsync(string assistantId, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != userId) return false;

            var user = await _databaseService.GetUserAsync(userId);
            if (user != null && user.Preferences.VisibleAssistantIds.Contains(assistantId))
            {
                user.Preferences.VisibleAssistantIds.Remove(assistantId);
                await _databaseService.UpdateUserAsync(user);
            }

            var success = await _databaseService.DeleteAssistantAsync(assistantId);
            
            if (success)
            {
                await NotifyAssistantsUpdated(userId);
            }

            return success;
        }

        public async Task<bool> AddSharedAssistantAsync(string assistantId, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null) return false;

            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            if (!user.Preferences.SharedAssistantIds.Contains(assistantId))
            {
                user.Preferences.SharedAssistantIds.Add(assistantId);
                user.Preferences.VisibleAssistantIds.Add(assistantId);
                await _databaseService.UpdateUserAsync(user);

                await NotifyAssistantsUpdated(userId);
            }

            return true;
        }

        public async Task<bool> ToggleAssistantVisibilityAsync(string assistantId, string userId)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            if (user.Preferences.VisibleAssistantIds.Contains(assistantId))
            {
                user.Preferences.VisibleAssistantIds.Remove(assistantId);
            }
            else
            {
                user.Preferences.VisibleAssistantIds.Add(assistantId);
            }

            await _databaseService.UpdateUserAsync(user);

            await NotifyAssistantsUpdated(userId);

            return true;
        }

        public async Task<string> GenerateShareLinkAsync(string assistantId, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != userId) 
            {
                throw new UnauthorizedAccessException("Cannot share assistant that is not owned by user");
            }

            return $"/assistants?add={assistantId}";
        }

        private async Task NotifyAssistantsUpdated(string userId)
        {
            var result = await GetUserAssistantsAsync(userId);
            var user = await _databaseService.GetUserAsync(userId);
            
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
                    IsVisible = user?.Preferences.VisibleAssistantIds.Contains(assistant.Id) ?? false
                }).ToList(),

                System = result.System.Select(assistant => new SystemAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    ModelName = assistant.Model.ModelName,
                    IsVisible = user?.Preferences.VisibleAssistantIds.Contains(assistant.Id) ?? false
                }).ToList(),

                Shared = result.Shared.Select(assistant => new SharedAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    ModelName = assistant.Model.ModelName,
                    IsVisible = user?.Preferences.VisibleAssistantIds.Contains(assistant.Id) ?? false
                }).ToList()
            };
            
            await _hubContext.Clients.Group(userId).SendAsync("UserAssistants", assistants);
        }
    }
}
