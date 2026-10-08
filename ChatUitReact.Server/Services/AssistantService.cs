using System.Collections.Concurrent;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Services.AiProviders;
using ChatUitReact.Server.Services.TokenCounting;
using ChatUitReact.Server.Services.Tools;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;

namespace ChatUitReact.Server.Services
{
    public class AssistantService : IAssistantService
    {
        private readonly IDatabaseService _databaseService;
        private readonly IModelService _modelService;
        private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
        private readonly IToolRegistry _toolRegistry;
        private readonly IToolAccessService _toolAccess;
        private readonly ITokenCountingService _tokenCounting;
        private readonly ToolOptions _toolOptions;
        private readonly ILogger<AssistantService> _logger;

        // Keyed by assistant id. Invalidated by the assistant's UpdatedAt and by the set of
        // active schemes, so both an edit and a newly registered model recount.
        private readonly ConcurrentDictionary<string, PromptTokenCacheEntry> _promptTokenCache = new();

        private sealed record PromptTokenCacheEntry(DateTime UpdatedAt, string SchemeKey, string UserKey, PromptTokenCounts Counts);

        // Per scheme: the whole fixed cost, and the part of it the knowledge-files section adds.
        private sealed record PromptTokenCounts(Dictionary<string, int> Prompt, Dictionary<string, int> Knowledge);

        public AssistantService(
            IDatabaseService databaseService,
            IModelService modelService,
            IHubContext<ChatHub, IChatHubClient> hubContext,
            IToolRegistry toolRegistry,
            IToolAccessService toolAccess,
            ITokenCountingService tokenCounting,
            IOptions<ToolOptions> toolOptions,
            ILogger<AssistantService> logger)
        {
            _databaseService = databaseService;
            _modelService = modelService;
            _hubContext = hubContext;
            _toolRegistry = toolRegistry;
            _toolAccess = toolAccess;
            _tokenCounting = tokenCounting;
            _toolOptions = toolOptions.Value;
            _logger = logger;
        }

        // The fixed cost of every request through this assistant, per scheme. Counted from the
        // same assembled prompt the provider receives. `user` is null on the admin paths, which
        // have no requesting user to render user snippets for.
        private async Task<PromptTokenCounts> GetPromptTokenCountsAsync(Assistant assistant, PromptUserContext? user)
        {
            var schemes = await _tokenCounting.GetActiveSchemeIdsAsync();
            var schemeKey = string.Join(",", schemes);
            var snippets = assistant.ChatSettings.PromptSnippets;
            var userKey = UserCacheKey(snippets, user);

            if (_promptTokenCache.TryGetValue(assistant.Id, out var cached) &&
                cached.UpdatedAt == assistant.UpdatedAt &&
                cached.SchemeKey == schemeKey &&
                cached.UserKey == userKey)
            {
                return cached.Counts;
            }

            var files = assistant.Files;
            var needsContent = files.Any(f =>
                f.Category == AssistantFileCategories.AlwaysLoaded &&
                f.Chunks.Any(c =>
                    (c.Type.Equals("text", StringComparison.OrdinalIgnoreCase) && c.Text == null) ||
                    (c.Type.Equals("image", StringComparison.OrdinalIgnoreCase) && c.Base64 == null)));
            if (needsContent)
            {
                var loaded = await _databaseService.GetAssistantByIdAsync(assistant.Id, includeFileContent: true);
                files = loaded?.Files ?? files;
            }

            // Pinned files are per chat and are counted by the client from the chat itself, so
            // the assistant's fixed cost is built with nothing pinned. The always-loaded files
            // are counted as the messages that carry them.
            var noLoadedFiles = new HashSet<string>();
            var knowledgeMessages = KnowledgeFileMessages.Build(files, []);
            var canLoadOnDemand = assistant.ChatSettings.Model.Capabilities.SupportsFunctionCalling;
            var prompt = SystemPromptAssembler.Build(assistant.ChatSettings.SystemPrompt, snippets, user, files, noLoadedFiles, canLoadOnDemand);
            // Resolved against the model row rather than the stored tool ids, so a model that
            // lost function calling after the assistant was saved counts no tools.
            var parameters = ChatParameterResolver.Resolve(assistant.ChatSettings.Model.Capabilities, assistant.ChatSettings);
            var tools = new List<ITool>(_toolRegistry.Resolve(parameters.ToolIds));
            var onDemandFiles = KnowledgeFileMessages.Loadable(files, noLoadedFiles);
            if (canLoadOnDemand && onDemandFiles.Count > 0)
            {
                tools.Add(new LoadKnowledgeFileTool(assistant.Id, onDemandFiles, _databaseService, _tokenCounting, _toolOptions, _logger));
            }

            var promptCounts = new Dictionary<string, int>();
            var knowledgeCounts = new Dictionary<string, int>();
            foreach (var scheme in schemes)
            {
                var knowledge = knowledgeMessages.Sum(message => _tokenCounting.CountMessage(message, scheme));
                promptCounts[scheme] = _tokenCounting.CountSystemPrompt(prompt, tools, scheme) + knowledge;
                knowledgeCounts[scheme] = knowledge;
            }

            var counts = new PromptTokenCounts(promptCounts, knowledgeCounts);
            _promptTokenCache[assistant.Id] = new PromptTokenCacheEntry(assistant.UpdatedAt, schemeKey, userKey, counts);
            return counts;
        }

        // Only the user fields the enabled snippets actually render take part, so assistants
        // without user snippets keep one cache entry for everyone.
        private static string UserCacheKey(IReadOnlyList<string> snippets, PromptUserContext? user)
        {
            if (user == null)
            {
                return string.Empty;
            }

            var parts = new List<string>();
            if (snippets.Contains(PromptSnippets.BasicUserInfo))
            {
                parts.Add($"{user.Name}|{user.JobRole}|{user.Email}");
            }
            if (snippets.Contains(PromptSnippets.AnswerPreferences))
            {
                parts.Add(user.AnswerPreferences);
            }
            return string.Join("\n", parts);
        }

        private async Task<Dictionary<string, PromptTokenCounts>> GetPromptTokenCountsAsync(IEnumerable<Assistant> assistants, PromptUserContext? user)
        {
            var result = new Dictionary<string, PromptTokenCounts>();
            foreach (var assistant in assistants)
            {
                result[assistant.Id] = await GetPromptTokenCountsAsync(assistant, user);
            }
            return result;
        }

        public async Task<PromptUserContext> GetPromptUserContextAsync(UserIdentity identity)
        {
            return BuildPromptUserContext(await _databaseService.GetUserAsync(identity.UserId), identity);
        }

        private static PromptUserContext BuildPromptUserContext(UserInfo? user, UserIdentity identity)
        {
            var profile = user?.Preferences.Profile ?? new UserProfile();
            var name = string.IsNullOrWhiteSpace(profile.DisplayName) ? identity.DisplayName : profile.DisplayName;
            return new PromptUserContext(name, profile.JobRole, identity.Email, profile.AnswerPreferences);
        }

        public async Task<UserAssistantsResult> GetUserAssistantsAsync(string userId, UserAccess access)
        {
            var user = await _databaseService.GetUserAsync(userId);
            return user == null ? new UserAssistantsResult() : await GetUserAssistantsAsync(userId, user, access);
        }

        private async Task<UserAssistantsResult> GetUserAssistantsAsync(string userId, UserInfo user, UserAccess access)
        {
            var ownedAssistants = await _databaseService.GetAssistantsByOwnerAsync(userId);
            var systemAssistants = (await _databaseService.GetSystemAssistantsAsync())
                .Where(a => a.Access == null || a.Access.Allows(access))
                .ToList();
            var sharedAssistants = await _databaseService.GetAssistantsByIdsAsync(user.Preferences.SharedAssistantIds);

            // A shared assistant is only usable while the user may use every tool on it. Policies
            // and the owner's tool list change over time, so the check is repeated on every load.
            var kept = new List<Assistant>();
            foreach (var shared in sharedAssistants)
            {
                var disallowed = await DisallowedToolNamesAsync(shared, access);
                if (disallowed.Count == 0)
                {
                    kept.Add(shared);
                    continue;
                }

                await RemoveSharedAssistantAsync(shared.Id, userId);
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Warning, SharedAssistantRemovedMessage(shared, disallowed));
            }

            foreach (var assistant in ownedAssistants.Concat(systemAssistants).Concat(kept))
            {
                await WithModelAsync(assistant);
            }

            return new UserAssistantsResult
            {
                Owned = ownedAssistants,
                System = systemAssistants,
                Shared = kept
            };
        }

        /// <summary>Display names of the tools on the assistant that this user may not use.</summary>
        public async Task<IReadOnlyList<string>> DisallowedToolNamesAsync(Assistant assistant, UserAccess access)
        {
            var check = await _toolAccess.CheckToolIdsAsync(assistant.ChatSettings.AvailableToolIds, access);
            return check.Disallowed.Select(id => _toolRegistry.Find(id)?.DisplayName ?? id).ToList();
        }

        public static string SharedAssistantRemovedMessage(Assistant assistant, IReadOnlyList<string> disallowedToolNames)
            => $"The shared assistant \"{assistant.Name}\" was removed from your list: it uses tools you are not allowed to use ({string.Join(", ", disallowedToolNames)}).";

        public async Task<Assistant?> GetAssistantByIdAsync(string assistantId, bool includeFileContent = false)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId, includeFileContent);
            return assistant == null ? null : await WithModelAsync(assistant);
        }

        // Assistants come from the database with only the model id; the model itself is read
        // from ModelService, which keeps every model in memory.
        private async Task<Assistant> WithModelAsync(Assistant assistant)
        {
            var model = await _modelService.GetModelByIdAsync(assistant.ChatSettings.Model.Id);
            if (model != null)
            {
                assistant.ChatSettings.Model = model;
            }
            return assistant;
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

        public async Task<bool> AddSharedAssistantAsync(string assistantId, string userId, UserAccess access)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null) return false;

            if (assistant.OwnerId == userId)
            {
                return false;
            }

            var disallowed = await DisallowedToolNamesAsync(assistant, access);
            if (disallowed.Count > 0)
            {
                throw new SharedAssistantRefusedException(assistant, disallowed);
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
            var assistants = await GetUserAssistantsAsync(userId, new UserAccess(roles, []));
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
        public async Task<AssistantListDto> GetUserAssistantsDtoAsync(UserIdentity identity, UserAccess access)
        {
            var roles = access.Roles.ToList();
            var user = await _databaseService.GetUserAsync(identity.UserId);
            if (user == null) return new AssistantListDto();

            var promptUser = BuildPromptUserContext(user, identity);
            var result = await GetUserAssistantsAsync(identity.UserId, user, access);

            var allAssistants = result.Owned.Concat(result.System).Concat(result.Shared).ToList();
            var eligibleModelIds = await GetDefaultEligibleModelIdsAsync(allAssistants, roles);
            var promptTokens = await GetPromptTokenCountsAsync(allAssistants, promptUser);

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
            foreach (var assistant in assistants)
            {
                await WithModelAsync(assistant);
            }
            var promptTokens = await GetPromptTokenCountsAsync(assistants, null);
            return assistants.Select(assistant => MapToFullAssistantDto(assistant, promptTokens[assistant.Id])).ToList();
        }

        public async Task<FullAssistantDto?> GetSystemAssistantForAdminAsync(string assistantId)
        {
            var assistant = await _databaseService.GetAssistantByIdAsync(assistantId);
            if (assistant == null || assistant.OwnerId != "System")
            {
                return null;
            }

            await WithModelAsync(assistant);
            return MapToFullAssistantDto(assistant, await GetPromptTokenCountsAsync(assistant, null));
        }

        public async Task<FullAssistantDto> CreateSystemAssistantAsync(CreateAssistantDto createDto)
        {
            var assistant = await BuildAssistantAsync(createDto, "System");
            var createdAssistant = await WithModelAsync(await _databaseService.CreateAssistantAsync(assistant));

            await NotifyAllUsersAssistantsUpdated();

            return MapToFullAssistantDto(createdAssistant, await GetPromptTokenCountsAsync(createdAssistant, null));
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

            await WithModelAsync(savedAssistant);
            return MapToFullAssistantDto(savedAssistant, await GetPromptTokenCountsAsync(savedAssistant, null));
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
                    createDto.AvailableToolIds,
                    createDto.PromptSnippets),
                Files = MapAssistantFiles(createDto.Files),
                OwnerId = ownerId,
                Access = ownerId == Assistant.SystemOwnerId ? MapAccess(createDto.Access) : null
            };
        }

        // Stores only settings the model can actually honour, so an assistant configured
        // against one model cannot carry an impossible combination onto another.
        private ChatSettings BuildChatSettings(
            Model model,
            string systemPrompt,
            float temperature,
            ReasoningEffort requestedEffort,
            List<string>? requestedToolIds,
            List<string>? requestedSnippets)
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
                // Stored under current ids: an assistant saved with a legacy id is rewritten on save.
                AvailableToolIds = capabilities.SupportsFunctionCalling
                    ? (requestedToolIds ?? new List<string>()).Select(_toolRegistry.Normalise).Distinct().ToList()
                    : new List<string>(),
                PromptSnippets = PromptSnippets.Normalize(requestedSnippets)
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
                updateDto.AvailableToolIds,
                updateDto.PromptSnippets);
            assistant.Files = MapAssistantFiles(updateDto.Files);
            if (assistant.IsSystem)
            {
                assistant.Access = MapAccess(updateDto.Access);
            }

            return true;
        }

        private static AssistantAccessPolicy? MapAccess(AssistantAccessPolicyDto? dto)
            => dto == null
                ? null
                : new AssistantAccessPolicy
                {
                    AllowedRoles = dto.AllowedRoles?.Distinct().ToList() ?? new List<UserRole>(),
                    AllowedGroupIds = dto.AllowedGroupIds?.Select(id => id.Trim()).Where(id => id.Length > 0).Distinct().ToList() ?? new List<string>()
                };

        private static AssistantAccessPolicyDto? MapAccess(AssistantAccessPolicy? access)
            => access == null ? null : new AssistantAccessPolicyDto { AllowedRoles = access.AllowedRoles.ToList(), AllowedGroupIds = access.AllowedGroupIds.ToList() };

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
                PromptSnippets = assistant.ChatSettings.PromptSnippets,
                IsVisible = !(user?.Preferences.HiddenAssistantIds.Contains(assistant.Id) ?? false),
                IsFavorite = user?.Preferences.FavoritedAssistantIds.Contains(assistant.Id) ?? false,
                CanBeDefault = eligibleModelIds?.Contains(assistant.ChatSettings.Model.Id) ?? false,
                Access = MapAccess(assistant.Access),
                Files = assistant.Files.Select(MapAssistantFileDto).ToList()
            };
        }

        private static List<AssistantFile> MapAssistantFiles(List<AssistantFileDto>? fileDtos)
        {
            if (fileDtos == null)
            {
                return new List<AssistantFile>();
            }

            foreach (var dto in fileDtos)
            {
                if (dto.Category == AssistantFileCategories.SelectiveLoaded && string.IsNullOrWhiteSpace(dto.Description))
                {
                    throw new AssistantValidationException($"On-demand file '{dto.SourceFilename}' needs a description.");
                }
            }

            return fileDtos.Select(dto => new AssistantFile
            {
                Id = string.IsNullOrWhiteSpace(dto.Id) ? Guid.NewGuid().ToString() : dto.Id,
                SourceFilename = dto.SourceFilename,
                Category = dto.Category,
                Description = dto.Description?.Trim(),
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

/// <summary>Thrown when an assistant create or update request fails validation. The message is safe to show the caller.</summary>
public sealed class AssistantValidationException : Exception
{
    public AssistantValidationException(string message) : base(message)
    {
    }
}

/// <summary>Thrown when a user tries to add a shared assistant whose tools they may not use.</summary>
public sealed class SharedAssistantRefusedException : Exception
{
    public SharedAssistantRefusedException(Assistant assistant, IReadOnlyList<string> disallowedToolNames)
        : base($"The assistant \"{assistant.Name}\" uses tools you are not allowed to use ({string.Join(", ", disallowedToolNames)}).")
    {
        DisallowedToolNames = disallowedToolNames;
    }

    public IReadOnlyList<string> DisallowedToolNames { get; }
}
