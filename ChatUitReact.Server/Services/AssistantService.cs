using ChatUitReact.Server.Models;
using ChatUitReact.Server.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Services
{
    public class AssistantService : IAssistantService
    {
        private readonly IDatabaseService _databaseService;
        private readonly IModelService _modelService;
        private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;

        public AssistantService(IDatabaseService databaseService, IModelService modelService, IHubContext<ChatHub, IChatHubClient> hubContext)
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

        public async Task<Assistant?> GetAssistantByIdAsync(string assistantId, bool includeFileContent = false)
        {
            return await _databaseService.GetAssistantByIdAsync(assistantId, includeFileContent);
        }

        public async Task<AssistantFileDto?> GetAssistantFileDtoAsync(string assistantId, string fileId)
        {
            var file = await _databaseService.GetAssistantFileAsync(assistantId, fileId);
            return file == null ? null : MapAssistantFileDto(file);
        }

        public async Task<bool> CreateAssistantAsync(CreateAssistantDto createDto, string userId)
        {
            var assistant = await BuildAssistantAsync(createDto, userId);
            await _databaseService.CreateAssistantAsync(assistant);

            await NotifyAssistantsUpdated(userId);
            
            return true;
        }

        public async Task<bool> UpdateAssistantAsync(UpdateAssistantDto updateDto, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(updateDto.Id);
            if (assistant == null || assistant.OwnerId != userId) return false;

            var updated = await ApplyAssistantUpdateAsync(assistant, updateDto);
            if (!updated) return false;

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
            if (user != null && user.Preferences.HiddenAssistantIds.Contains(assistantId))
            {
                user.Preferences.HiddenAssistantIds.Remove(assistantId);
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

            if (assistant.OwnerId == userId)
            {
                return false;
            }

            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            if (!user.Preferences.SharedAssistantIds.Contains(assistantId))
            {
                user.Preferences.SharedAssistantIds.Add(assistantId);
                await _databaseService.UpdateUserAsync(user);

                await NotifyAssistantsUpdated(userId);
            }

            return true;
        }

        public async Task<bool> RemoveSharedAssistantAsync(string assistantId, string userId)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            if (user.Preferences.SharedAssistantIds.Contains(assistantId))
            {
                user.Preferences.SharedAssistantIds.Remove(assistantId);
                await _databaseService.UpdateUserAsync(user);
                await NotifyAssistantsUpdated(userId);
            }

            return true;
        }

        public async Task<bool> ToggleAssistantVisibilityAsync(string assistantId, string userId)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            if (user.Preferences.HiddenAssistantIds.Contains(assistantId))
            {
                user.Preferences.HiddenAssistantIds.Remove(assistantId);
            }
            else
            {
                user.Preferences.HiddenAssistantIds.Add(assistantId);
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

        public async Task<AssistantListDto> GetUserAssistantsDtoAsync(string userId)
        {
            var result = await GetUserAssistantsAsync(userId);
            var user = await _databaseService.GetUserAsync(userId);
            
            return new AssistantListDto
            {
                Owned = result.Owned.Select(assistant => MapToFullAssistantDto(assistant, user)).ToList(),
                System = result.System.Select(assistant => MapToAssistantSummaryDto(assistant, user)).ToList(),
                Shared = result.Shared.Select(assistant => MapToAssistantSummaryDto(assistant, user)).ToList()
            };
        }

        public async Task<List<FullAssistantDto>> GetSystemAssistantsForAdminAsync()
        {
            var assistants = await _databaseService.GetSystemAssistantsAsync();
            return assistants.Select(assistant => MapToFullAssistantDto(assistant)).ToList();
        }

        public async Task<FullAssistantDto?> GetSystemAssistantForAdminAsync(string assistantId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != "System")
            {
                return null;
            }

            return MapToFullAssistantDto(assistant);
        }

        public async Task<FullAssistantDto> CreateSystemAssistantAsync(CreateAssistantDto createDto)
        {
            var assistant = await BuildAssistantAsync(createDto, "System");
            var createdAssistant = await _databaseService.CreateAssistantAsync(assistant);

            await NotifySystemAssistantsUpdated();

            return MapToFullAssistantDto(createdAssistant);
        }

        public async Task<FullAssistantDto?> UpdateSystemAssistantAsync(string assistantId, UpdateAssistantDto updateDto)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != "System")
            {
                return null;
            }

            var updated = await ApplyAssistantUpdateAsync(assistant, updateDto);
            if (!updated)
            {
                return null;
            }

            var savedAssistant = await _databaseService.UpdateAssistantAsync(assistant);
            if (savedAssistant == null)
            {
                return null;
            }

            await NotifySystemAssistantsUpdated();

            return MapToFullAssistantDto(savedAssistant);
        }

        public async Task<bool> DeleteSystemAssistantAsync(string assistantId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != "System")
            {
                return false;
            }

            var deleted = await _databaseService.DeleteAssistantAsync(assistantId);
            if (deleted)
            {
                await NotifySystemAssistantsUpdated();
            }

            return deleted;
        }

        private async Task NotifyAssistantsUpdated(string userId)
        {
            await _hubContext.Clients.Group(userId).AssistantsUpdated();
        }

        private async Task NotifySystemAssistantsUpdated()
        {
            await _hubContext.Clients.All.AssistantsUpdated();
        }

        private async Task<Assistant> BuildAssistantAsync(CreateAssistantDto createDto, string ownerId)
        {
            var model = await _modelService.GetModelByIdAsync(createDto.ModelId);
            if (model == null)
            {
                throw new ArgumentException("Invalid model ID", nameof(createDto.ModelId));
            }

            return new Assistant
            {
                Name = createDto.Name,
                Description = createDto.Description,
                Tags = createDto.Tags,
                ChatSettings = BuildChatSettings(
                    model,
                    createDto.SystemPrompt,
                    createDto.Temperature,
                    createDto.ReasoningEffort,
                    createDto.AvailableToolIds),
                Files = MapAssistantFiles(createDto.Files),
                OwnerId = ownerId
            };
        }

        // Stores only settings the model can actually honour, so an assistant configured
        // against one model cannot carry an impossible combination onto another.
        private static ChatSettings BuildChatSettings(
            Model model,
            string systemPrompt,
            float temperature,
            ReasoningEffort requestedEffort,
            List<string>? requestedToolIds)
        {
            var capabilities = model.Capabilities;

            var effort = capabilities.SupportsEffort(requestedEffort)
                ? requestedEffort
                : capabilities.ClampEffort(requestedEffort);

            return new ChatSettings
            {
                SystemPrompt = systemPrompt,
                Temperature = capabilities.Temperature == TemperatureSupport.Unsupported ? 1f : temperature,
                ReasoningEffort = effort,
                Model = model,
                AvailableToolIds = capabilities.SupportsFunctionCalling
                    ? requestedToolIds ?? new List<string>()
                    : new List<string>()
            };
        }

        private async Task<bool> ApplyAssistantUpdateAsync(Assistant assistant, UpdateAssistantDto updateDto)
        {
            var model = await _modelService.GetModelByIdAsync(updateDto.ModelId);
            if (model == null)
            {
                return false;
            }

            assistant.Name = updateDto.Name;
            assistant.Description = updateDto.Description;
            assistant.Tags = updateDto.Tags;
            assistant.ChatSettings = BuildChatSettings(
                model,
                updateDto.SystemPrompt,
                updateDto.Temperature,
                updateDto.ReasoningEffort,
                updateDto.AvailableToolIds);
            assistant.Files = MapAssistantFiles(updateDto.Files);

            return true;
        }

        private static FullAssistantDto MapToFullAssistantDto(Assistant assistant, UserInfo? user = null)
        {
            return new FullAssistantDto
            {
                Id = assistant.Id,
                Name = assistant.Name,
                Description = assistant.Description,
                Tags = assistant.Tags,
                ModelId = assistant.ChatSettings.Model.Id,
                SystemPrompt = assistant.ChatSettings.SystemPrompt,
                Temperature = assistant.ChatSettings.Temperature,
                ReasoningEffort = assistant.ChatSettings.ReasoningEffort,
                AvailableToolIds = assistant.ChatSettings.AvailableToolIds,
                IsVisible = !(user?.Preferences.HiddenAssistantIds.Contains(assistant.Id) ?? false),
                Files = assistant.Files.Select(MapAssistantFileDto).ToList()
            };
        }

        private static List<AssistantFile> MapAssistantFiles(List<AssistantFileDto>? fileDtos)
        {
            if (fileDtos == null)
            {
                return new List<AssistantFile>();
            }

            return fileDtos.Select(dto => new AssistantFile
            {
                Id = string.IsNullOrWhiteSpace(dto.Id) ? Guid.NewGuid().ToString() : dto.Id,
                SourceFilename = dto.SourceFilename,
                Category = dto.Category,
                Description = dto.Description,
                Chunks = dto.Chunks.Select(chunk => new ChatFileChunk
                {
                    Type = chunk.Type,
                    Text = chunk.Text,
                    Format = chunk.Format,
                    Base64 = chunk.Base64
                }).ToList()
            }).ToList();
        }

        private static AssistantFileDto MapAssistantFileDto(AssistantFile file)
        {
            return new AssistantFileDto
            {
                Id = file.Id,
                SourceFilename = file.SourceFilename,
                Category = file.Category,
                Description = file.Description,
                Chunks = file.Chunks.Select(chunk => new ChatFileChunkDto
                {
                    Type = chunk.Type,
                    Text = chunk.Text,
                    Format = chunk.Format,
                    Base64 = chunk.Base64
                }).ToList()
            };
        }

        private static AssistantSummaryDto MapToAssistantSummaryDto(Assistant assistant, UserInfo? user = null)
        {
            return new AssistantSummaryDto
            {
                Id = assistant.Id,
                Name = assistant.Name,
                Description = assistant.Description,
                Tags = assistant.Tags,
                ModelId = assistant.ChatSettings.Model.Id,
                IsVisible = !(user?.Preferences.HiddenAssistantIds.Contains(assistant.Id) ?? false),
                CreatedBy = assistant.OwnerId
            };
        }
    }
}
