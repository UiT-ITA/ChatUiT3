using System.Collections.Concurrent;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Services.AiProviders;
using ChatUitReact.Server.Services.TokenCounting;
using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Services
{
    public class AssistantService : IAssistantService
    {
        private readonly IDatabaseService _databaseService;
        private readonly IModelService _modelService;
        private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
        private readonly IToolService _toolService;
        private readonly ITokenCountingService _tokenCounting;

        // Keyed by assistant id. Invalidated by the assistant's UpdatedAt and by the set of
        // active schemes, so both an edit and a newly registered model recount.
        private readonly ConcurrentDictionary<string, PromptTokenCacheEntry> _promptTokenCache = new();

        private sealed record PromptTokenCacheEntry(DateTime UpdatedAt, string SchemeKey, PromptTokenCounts Counts);

        // Per scheme: the whole fixed cost, and the part of it the knowledge-files section adds.
        private sealed record PromptTokenCounts(Dictionary<string, int> Prompt, Dictionary<string, int> Knowledge);

        public AssistantService(
            IDatabaseService databaseService,
            IModelService modelService,
            IHubContext<ChatHub, IChatHubClient> hubContext,
            IToolService toolService,
            ITokenCountingService tokenCounting)
        {
            _databaseService = databaseService;
            _modelService = modelService;
            _hubContext = hubContext;
            _toolService = toolService;
            _tokenCounting = tokenCounting;
        }

        // The fixed cost of every request through this assistant, per scheme. Counted from the
        // same assembled prompt the provider receives.
        private async Task<PromptTokenCounts> GetPromptTokenCountsAsync(Assistant assistant)
        {
            var schemes = await _tokenCounting.GetActiveSchemeIdsAsync();
            var schemeKey = string.Join(",", schemes);

            if (_promptTokenCache.TryGetValue(assistant.Id, out var cached) &&
                cached.UpdatedAt == assistant.UpdatedAt &&
                cached.SchemeKey == schemeKey)
            {
                return cached.Counts;
            }

            var files = assistant.Files;
            var needsContent = files.Any(f =>
                f.Category == AssistantFileCategories.AlwaysLoaded &&
                f.Chunks.Any(c => c.Type.Equals("text", StringComparison.OrdinalIgnoreCase) && c.Text == null));
            if (needsContent)
            {
                var loaded = await _databaseService.GetAssistantByIdAsync(assistant.Id, includeFileContent: true);
                files = loaded?.Files ?? files;
            }

            var prompt = SystemPromptAssembler.AppendKnowledgeFiles(assistant.ChatSettings.SystemPrompt, files);
            // Resolved against the model row rather than the stored tool ids, so a model that
            // lost function calling after the assistant was saved counts no tools.
            var parameters = ChatParameterResolver.Resolve(assistant.ChatSettings.Model.Capabilities, assistant.ChatSettings);
            var tools = _toolService.GetToolDefinitions(parameters.ToolIds).ToList();

            var systemPrompt = assistant.ChatSettings.SystemPrompt ?? string.Empty;
            var hasKnowledge = prompt != systemPrompt;

            var promptCounts = new Dictionary<string, int>();
            var knowledgeCounts = new Dictionary<string, int>();
            foreach (var scheme in schemes)
            {
                promptCounts[scheme] = _tokenCounting.CountSystemPrompt(prompt, tools, scheme);
                knowledgeCounts[scheme] = hasKnowledge
                    ? Math.Max(0, _tokenCounting.CountText(prompt, scheme) - _tokenCounting.CountText(systemPrompt, scheme))
                    : 0;
            }

            var counts = new PromptTokenCounts(promptCounts, knowledgeCounts);
            _promptTokenCache[assistant.Id] = new PromptTokenCacheEntry(assistant.UpdatedAt, schemeKey, counts);
            return counts;
        }

        private async Task<Dictionary<string, PromptTokenCounts>> GetPromptTokenCountsAsync(IEnumerable<Assistant> assistants)
        {
            var result = new Dictionary<string, PromptTokenCounts>();
            foreach (var assistant in assistants)
            {
                result[assistant.Id] = await GetPromptTokenCountsAsync(assistant);
            }
            return result;
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

            var previousModelId = assistant.ChatSettings.Model.Id;

            var updated = await ApplyAssistantUpdateAsync(assistant, updateDto);
            if (!updated) return false;

            var updatedAssistant = await _databaseService.UpdateAssistantAsync(assistant);
            if (updatedAssistant == null) return false;
            _promptTokenCache.TryRemove(assistant.Id, out _);

            // A model change can invalidate a pin held by someone this assistant was shared
            // with, so notify everyone rather than just the owner's group. Otherwise their open
            // tab keeps its cached list and keeps starting new chats on the old model.
            if (assistant.ChatSettings.Model.Id != previousModelId)
            {
                await NotifyAllUsersAssistantsUpdated();
            }
            else
            {
                await NotifyAssistantsUpdated(userId);
            }

            return true;
        }

        public async Task<bool> DeleteAssistantAsync(string assistantId, string userId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != userId) return false;

            var user = await _databaseService.GetUserAsync(userId);
            if (user != null && ForgetAssistantInPreferences(user, assistantId))
            {
                await _databaseService.UpdateUserAsync(user);
            }

            var success = await _databaseService.DeleteAssistantAsync(assistantId);
            
            if (success)
            {
                _promptTokenCache.TryRemove(assistantId, out _);
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
                ForgetAssistantInPreferences(user, assistantId);
                await _databaseService.UpdateUserAsync(user);
                await NotifyAssistantsUpdated(userId);
            }

            return true;
        }

        public async Task<bool> SetDefaultAssistantAsync(string assistantId, string userId, List<UserRole> roles)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            // Membership, not existence: GetAssistantByIdAsync has no access check, so any
            // assistant GUID would otherwise be pinnable.
            var assistants = await GetUserAssistantsAsync(userId);
            var assistant = assistants.Owned
                .Concat(assistants.System)
                .Concat(assistants.Shared)
                .FirstOrDefault(a => a.Id == assistantId);

            if (assistant == null) return false;
            if (!await IsModelDefaultEligibleAsync(assistant.ChatSettings.Model.Id, roles)) return false;

            user.Preferences.DefaultAssistantId = assistantId;
            await _databaseService.UpdateUserAsync(user);
            await NotifyAssistantsUpdated(userId);

            return true;
        }

        public async Task<bool> ClearDefaultAssistantAsync(string userId)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            if (user.Preferences.DefaultAssistantId != null)
            {
                user.Preferences.DefaultAssistantId = null;
                await _databaseService.UpdateUserAsync(user);
                await NotifyAssistantsUpdated(userId);
            }

            return true;
        }

        // Drops every reference to an assistant from a user's own preferences. Returns whether
        // anything changed, so the caller writes the user document at most once.
        private static bool ForgetAssistantInPreferences(UserInfo user, string assistantId)
        {
            var changed = user.Preferences.HiddenAssistantIds.Remove(assistantId);

            if (user.Preferences.DefaultAssistantId == assistantId)
            {
                user.Preferences.DefaultAssistantId = null;
                changed = true;
            }

            return changed;
        }

        // Resolved through ModelService rather than off the assistant's embedded Model: only the
        // model id is persisted on an assistant, so a null result covers a deleted model, a model
        // this user's roles cannot reach, and a stale snapshot all at once.
        private async Task<bool> IsModelDefaultEligibleAsync(string? modelId, List<UserRole> roles)
        {
            if (string.IsNullOrWhiteSpace(modelId)) return false;

            var model = await _modelService.GetModelForUserAsync(modelId, roles);
            return model?.AllowedAsDefault == true;
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

        public async Task<bool> ToggleAssistantFavoriteAsync(string assistantId, string userId)
        {
            var user = await _databaseService.GetUserAsync(userId);
            if (user == null) return false;

            if (user.Preferences.FavoritedAssistantIds.Contains(assistantId))
            {
                user.Preferences.FavoritedAssistantIds.Remove(assistantId);
            }
            else
            {
                user.Preferences.FavoritedAssistantIds.Add(assistantId);
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

        // Roles come from the caller's claims, not from the stored user document: nothing ever
        // writes claim roles into a user document, so UserInfo.Roles is empty in production.
        public async Task<AssistantListDto> GetUserAssistantsDtoAsync(string userId, List<UserRole> roles)
        {
            var result = await GetUserAssistantsAsync(userId);
            var user = await _databaseService.GetUserAsync(userId);

            var allAssistants = result.Owned.Concat(result.System).Concat(result.Shared).ToList();
            var eligibleModelIds = await GetDefaultEligibleModelIdsAsync(allAssistants, roles);
            var promptTokens = await GetPromptTokenCountsAsync(allAssistants);

            return new AssistantListDto
            {
                Owned = result.Owned.Select(assistant => MapToFullAssistantDto(assistant, promptTokens[assistant.Id], user, eligibleModelIds)).ToList(),
                System = result.System.Select(assistant => MapToAssistantSummaryDto(assistant, promptTokens[assistant.Id], user, eligibleModelIds)).ToList(),
                Shared = result.Shared.Select(assistant => MapToAssistantSummaryDto(assistant, promptTokens[assistant.Id], user, eligibleModelIds)).ToList(),
                DefaultAssistantId = user?.Preferences.DefaultAssistantId
            };
        }

        // Resolved once per distinct model id so the mappers stay synchronous.
        private async Task<HashSet<string>> GetDefaultEligibleModelIdsAsync(
            IEnumerable<Assistant> assistants,
            List<UserRole> roles)
        {
            var modelIds = assistants
                .Select(a => a.ChatSettings.Model.Id)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();

            var eligible = new HashSet<string>();

            foreach (var modelId in modelIds)
            {
                if (await IsModelDefaultEligibleAsync(modelId, roles))
                {
                    eligible.Add(modelId);
                }
            }

            return eligible;
        }

        public async Task<List<FullAssistantDto>> GetSystemAssistantsForAdminAsync()
        {
            var assistants = await _databaseService.GetSystemAssistantsAsync();
            var promptTokens = await GetPromptTokenCountsAsync(assistants);
            return assistants.Select(assistant => MapToFullAssistantDto(assistant, promptTokens[assistant.Id])).ToList();
        }

        public async Task<FullAssistantDto?> GetSystemAssistantForAdminAsync(string assistantId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != "System")
            {
                return null;
            }

            return MapToFullAssistantDto(assistant, await GetPromptTokenCountsAsync(assistant));
        }

        public async Task<FullAssistantDto> CreateSystemAssistantAsync(CreateAssistantDto createDto)
        {
            var assistant = await BuildAssistantAsync(createDto, "System");
            var createdAssistant = await _databaseService.CreateAssistantAsync(assistant);

            await NotifyAllUsersAssistantsUpdated();

            return MapToFullAssistantDto(createdAssistant, await GetPromptTokenCountsAsync(createdAssistant));
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

            _promptTokenCache.TryRemove(assistantId, out _);
            await NotifyAllUsersAssistantsUpdated();

            return MapToFullAssistantDto(savedAssistant, await GetPromptTokenCountsAsync(savedAssistant));
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
                _promptTokenCache.TryRemove(assistantId, out _);
                await NotifyAllUsersAssistantsUpdated();
            }

            return deleted;
        }

        private async Task NotifyAssistantsUpdated(string userId)
        {
            await _hubContext.Clients.Group(userId).AssistantsUpdated();
        }

        // Used when a change can affect users beyond the one who made it: a system assistant,
        // or a model change on an assistant that others have shared or pinned.
        private async Task NotifyAllUsersAssistantsUpdated()
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

        // eligibleModelIds is null on the admin paths, which have no user to pin anything for.
        private static FullAssistantDto MapToFullAssistantDto(
            Assistant assistant,
            PromptTokenCounts promptTokenCounts,
            UserInfo? user = null,
            HashSet<string>? eligibleModelIds = null)
        {
            return new FullAssistantDto
            {
                PromptTokenCounts = promptTokenCounts.Prompt,
                KnowledgeTokenCounts = promptTokenCounts.Knowledge,
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
                IsFavorite = user?.Preferences.FavoritedAssistantIds.Contains(assistant.Id) ?? false,
                CanBeDefault = eligibleModelIds?.Contains(assistant.ChatSettings.Model.Id) ?? false,
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

        private static AssistantSummaryDto MapToAssistantSummaryDto(
            Assistant assistant,
            PromptTokenCounts promptTokenCounts,
            UserInfo? user = null,
            HashSet<string>? eligibleModelIds = null)
        {
            return new AssistantSummaryDto
            {
                PromptTokenCounts = promptTokenCounts.Prompt,
                KnowledgeTokenCounts = promptTokenCounts.Knowledge,
                Id = assistant.Id,
                Name = assistant.Name,
                Description = assistant.Description,
                Tags = assistant.Tags,
                ModelId = assistant.ChatSettings.Model.Id,
                IsVisible = !(user?.Preferences.HiddenAssistantIds.Contains(assistant.Id) ?? false),
                IsFavorite = user?.Preferences.FavoritedAssistantIds.Contains(assistant.Id) ?? false,
                CanBeDefault = eligibleModelIds?.Contains(assistant.ChatSettings.Model.Id) ?? false,
                CreatedBy = assistant.OwnerId
            };
        }
    }
}
