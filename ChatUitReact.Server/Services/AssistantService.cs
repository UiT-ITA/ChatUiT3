using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
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

        public async Task<AssistantListDto> GetUserAssistantsAsync(string userId)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return new AssistantListDto();

            var ownedAssistants = await _databaseService.GetAssistantsByOwnerAsync(userId);
            var systemAssistants = await _databaseService.GetSystemAssistantsAsync();
            var sharedAssistants = await _databaseService.GetAssistantsByIdsAsync(user.Preferences.SharedAssistantIds);

            return new AssistantListDto
            {
                Owned = ownedAssistants.Select(assistant => new PrivateAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    Model = assistant.Model,
                    ChatSettings = assistant.ChatSettings,
                    IsVisible = user.Preferences.VisibleAssistantIds.Contains(assistant.Id)
                }).ToList(),

                System = systemAssistants.Select(assistant => new SystemAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    ModelName = assistant.Model.ModelName,
                    IsVisible = user.Preferences.VisibleAssistantIds.Contains(assistant.Id)
                }).ToList(),

                Shared = sharedAssistants.Select(assistant => new SharedAssistantDto
                {
                    Id = assistant.Id,
                    Name = assistant.Name,
                    Description = assistant.Description,
                    Tags = assistant.Tags,
                    ModelName = assistant.Model.ModelName,
                    IsVisible = user.Preferences.VisibleAssistantIds.Contains(assistant.Id)
                }).ToList()
            };
        }

        public async Task<PrivateAssistantDto?> GetAssistantByIdAsync(string assistantId, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null) return null;

            if (assistant.OwnerId != userId && assistant.OwnerId != "System")
            {
                return null;
            }

            var user = await _databaseService.GetUserAsync(userId);
            
            return new PrivateAssistantDto
            {
                Id = assistant.Id,
                Name = assistant.Name,
                Description = assistant.Description,
                Tags = assistant.Tags,
                Model = assistant.Model,
                ChatSettings = assistant.ChatSettings,
                IsVisible = user?.Preferences.VisibleAssistantIds.Contains(assistant.Id) ?? false
            };
        }

        public async Task<bool> CreateAssistantAsync(CreateAssistantDto createDto, string userId)
        {
            var model = await _modelService.GetModelByIdAsync(createDto.ModelId);
            if (model == null)
            {
                throw new ArgumentException("Invalid model ID", nameof(createDto.ModelId));
            }

            var assistant = new AiAssistant
            {
                Name = createDto.Name,
                Description = createDto.Description,
                Tags = createDto.Tags,
                Model = model,
                ChatSettings = createDto.ChatSettings,
                OwnerId = userId
            };

            var createdAssistant = await _databaseService.CreateAssistantAsync(assistant);
            
            // Add to visible list by default
            var user = await _databaseService.GetUserAsync(userId);
            if (user != null && !user.Preferences.VisibleAssistantIds.Contains(createdAssistant.Id))
            {
                user.Preferences.VisibleAssistantIds.Add(createdAssistant.Id);
                await _databaseService.UpdateUserAsync(user);
            }

            // Notify all connected clients for this user
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
            assistant.ChatSettings = updateDto.ChatSettings;

            var updatedAssistant = await _databaseService.UpdateAssistantAsync(assistant);
            if (updatedAssistant == null) return false;

            // Notify all connected clients for this user
            // Console.WriteLine($"Assistant {assistant.Id} updated by user {userId}");
            await NotifyAssistantsUpdated(userId);

            return true;
        }

        public async Task<bool> DeleteAssistantAsync(string assistantId, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != userId) return false;

            // Remove from visible list
            var user = await _databaseService.GetUserAsync(userId);
            if (user != null && user.Preferences.VisibleAssistantIds.Contains(assistantId))
            {
                user.Preferences.VisibleAssistantIds.Remove(assistantId);
                await _databaseService.UpdateUserAsync(user);
            }

            var success = await _databaseService.DeleteAssistantAsync(assistantId);
            
            if (success)
            {
                // Notify all connected clients for this user
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
                // Add to visible by default
                user.Preferences.VisibleAssistantIds.Add(assistantId);
                await _databaseService.UpdateUserAsync(user);

                // Notify all connected clients for this user
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

            // Notify all connected clients for this user
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
            var assistants = await GetUserAssistantsAsync(userId);
            await _hubContext.Clients.User(userId).SendAsync("UserAssistants", assistants);
        }
    }
}
