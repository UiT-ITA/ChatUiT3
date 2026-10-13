using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;
using System.Diagnostics;
using ChatUitReact.Server.Services.TokenCounting;
using ChatUitReact.Server.Services.Tools;
using ChatUitReact.Server.Services.Knowledge;
using System.Text;
using System.Text.Json;
using System.Security.Claims;
using Microsoft.Extensions.Options;

namespace ChatUitReact.Server.Services;

public class ChatService : IChatService
{
    private const string GenerationFailedText = "*The response could not be completed because an error occurred while generating it.*";
    private static readonly TimeSpan StaleGenerationThreshold = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Upper bound on a single generation, tool rounds included. Matches the threshold that
    /// marks an abandoned message as failed, so a run can never outlive its own message.
    /// </summary>
    private static readonly TimeSpan GenerationTimeout = StaleGenerationThreshold;

    private readonly AiConversationRunner _conversationRunner;
    private readonly IAiProviderRegistry _providers;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    private readonly ILogger<ChatService> _logger;
    private readonly IDatabaseService _databaseService;
    private readonly StreamingService _streamingService;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;
    private readonly IToolRegistry _toolRegistry;
    private readonly IToolAccessService _toolAccess;
    private readonly PendingInteractionRegistry _pendingInteractions;
    private readonly ISettingsService _settingsService;
    private readonly ITokenCountingService _tokenCounting;
    private readonly ToolOptions _toolOptions;
    private readonly IKnowledgeSourceRegistry _knowledgeSources;

    public ChatService(
        AiConversationRunner conversationRunner,
        IAiProviderRegistry providers,
        IHubContext<ChatHub, IChatHubClient> hubContext,
        ILogger<ChatService> logger,
        IDatabaseService databaseService,
        StreamingService streamingService,
        IAssistantService assistantService,
        IModelService modelService,
        IToolRegistry toolRegistry,
        IToolAccessService toolAccess,
        PendingInteractionRegistry pendingInteractions,
        ISettingsService settingsService,
        ITokenCountingService tokenCounting,
        IOptions<ToolOptions> toolOptions,
        IKnowledgeSourceRegistry knowledgeSources)
    {
        _conversationRunner = conversationRunner;
        _providers = providers;
        _hubContext = hubContext;
        _logger = logger;
        _databaseService = databaseService;
        _streamingService = streamingService;
        _assistantService = assistantService;
        _modelService = modelService;
        _toolRegistry = toolRegistry;
        _toolAccess = toolAccess;
        _pendingInteractions = pendingInteractions;
        _settingsService = settingsService;
        _tokenCounting = tokenCounting;
        _toolOptions = toolOptions.Value;
        _knowledgeSources = knowledgeSources;
    }

    #region Chat management

    public async Task<List<ChatHeader>> GetChatListAsync(string userId)
    {
        return await _databaseService.GetChatListAsync(userId);
    }

    public async Task<Chat?> GetChatByIdAsync(string userId, string chatId, bool includeFileContent = true)
    {
        var chat = await _databaseService.GetChatByIdAsync(userId, chatId, includeFileContent);
        if (chat == null)
        {
            return null;
        }

        // A message left in Generating (e.g. after a server restart mid-stream) would
        // otherwise stay in that state forever; mark it as failed once it goes stale.
        foreach (var message in chat.Messages)
        {
            if (message.Status != AiChatStatus.Generating ||
                DateTime.UtcNow - message.Timestamp < StaleGenerationThreshold ||
                _streamingService.IsGenerationActive(userId, message.Id))
            {
                // A run paused on a tool confirmation is still alive; only orphaned runs are failed.
                continue;
            }

            message.Status = AiChatStatus.Error;
            message.Content = string.IsNullOrWhiteSpace(message.Content)
                ? GenerationFailedText
                : $"{message.Content}\n\n{GenerationFailedText}";
            // The content changed, so any stored counts are stale. Assistant messages carry
            // no files, so counting the copy below is counting the message.
            message.TokenCounts = new Dictionary<string, int>();

            // Persist through a copy without files: an empty file list keeps the stored
            // files untouched, which matters when this chat was loaded metadata-only.
            var fixedMessage = new Models.ChatMessage
            {
                Id = message.Id,
                Role = message.Role,
                Timestamp = message.Timestamp,
                Status = message.Status,
                Content = message.Content,
                Files = new List<ChatFile>()
            };
            _tokenCounting.FillMissingMessageCounts(fixedMessage, await _tokenCounting.GetActiveSchemeIdsAsync());
            message.TokenCounts = fixedMessage.TokenCounts;
            message.FileTokenCounts = fixedMessage.FileTokenCounts;
            await _databaseService.UpdateMessageAsync(userId, chatId, fixedMessage);
        }

        await BackfillTokenCountsAsync(userId, chatId, chat, includeFileContent);

        return chat;
    }

    // Counts are stored per message so a model switch is a key lookup on the client. Messages
    // lacking a count for an active scheme are counted on first read and written back, so each
    // message is counted at most once per scheme.
    private async Task BackfillTokenCountsAsync(string userId, string chatId, Chat chat, bool includeFileContent)
    {
        var schemes = await _tokenCounting.GetActiveSchemeIdsAsync();
        if (schemes.Count == 0)
        {
            return;
        }

        var needingCounts = chat.Messages
            .Where(m => m.Status != AiChatStatus.Generating && schemes.Any(s => LacksCount(m, s)))
            .ToList();

        if (needingCounts.Count == 0)
        {
            return;
        }

        // Attachments dominate the count and are absent from a metadata-only load. One
        // content load for the whole chat beats one fetch per file.
        IReadOnlyDictionary<string, Models.ChatMessage> countingSource;
        if (!includeFileContent && needingCounts.Any(m => m.Files.Count > 0))
        {
            var fullChat = await _databaseService.GetChatByIdAsync(userId, chatId, includeFileContent: true);
            countingSource = (fullChat?.Messages ?? new List<Models.ChatMessage>()).ToDictionary(m => m.Id);
        }
        else
        {
            countingSource = needingCounts.ToDictionary(m => m.Id);
        }

        foreach (var message in needingCounts)
        {
            if (!countingSource.TryGetValue(message.Id, out var source))
            {
                continue;
            }

            // Carry over what the source lacks so the fill only counts the missing keys.
            foreach (var (schemeId, tokens) in message.TokenCounts)
            {
                source.TokenCounts.TryAdd(schemeId, tokens);
            }
            foreach (var (schemeId, tokens) in message.FileTokenCounts)
            {
                source.FileTokenCounts.TryAdd(schemeId, tokens);
            }

            if (_tokenCounting.FillMissingMessageCounts(source, schemes))
            {
                message.TokenCounts = source.TokenCounts;
                message.FileTokenCounts = source.FileTokenCounts;
                await _databaseService.SetMessageTokenCountsAsync(userId, chatId, message.Id, message.TokenCounts, message.FileTokenCounts);
            }
        }
    }

    // The attachment share only exists for messages with files; file metadata is present
    // even on a metadata-only load, so Files.Count is reliable here.
    private static bool LacksCount(Models.ChatMessage message, string schemeId) =>
        !message.TokenCounts.ContainsKey(schemeId) ||
        (message.Files.Count > 0 && !message.FileTokenCounts.ContainsKey(schemeId));

    public async Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId)
    {
        return await _databaseService.GetChatFileAsync(userId, chatId, fileId);
    }

    public async Task<Chat> CreateChatAsync(string userId, string assistantId)
    {
        var newChat = new Chat
        {
            Name = "New chat",
            AssistantId = assistantId
        };

        await _databaseService.AddChatAsync(userId, newChat);
        NotifyChatListUpdated(userId);

        return newChat;
    }

    public async Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null)
    {
        if (newTitle == null && newAssistantId == null)
        {
            return;
        }

        await _databaseService.UpdateChatAsync(userId, chatId, newTitle, newAssistantId);

        if (newTitle != null || newAssistantId != null)
        {
            NotifyChatListUpdated(userId);
        }
    }

    public async Task SetChatFavoriteAsync(string userId, string chatId, bool isFavorite)
    {
        await _databaseService.SetChatFavoriteAsync(userId, chatId, isFavorite);
        NotifyChatListUpdated(userId);
    }

    public async Task DeleteChatAsync(string userId, string chatId)
    {
        await _databaseService.DeleteChatAsync(userId, chatId);
        NotifyChatListUpdated(userId);
    }

    #endregion Chat management

    #region Message operations

    public async Task SendMessageAsync(string userId, string chatId, Models.ChatMessage message, PromptUserContext promptUser)
    {
        await SendStreamingMessageAsync(userId, chatId, message, promptUser);
    }

    public async Task SendMessageAsync(string userId, string chatId, Models.ChatMessage message, string? assistantId, PromptUserContext promptUser)
    {
        await SendStreamingMessageAsync(userId, chatId, message, assistantId, promptUser);
    }

    public async Task SendStreamingMessageAsync(string userId, string chatId, Models.ChatMessage userMessage, PromptUserContext promptUser)
    {
        await SendStreamingMessageAsync(userId, chatId, userMessage, null, promptUser);
    }

    public Task SendStreamingMessageAsync(string userId, string chatId, Models.ChatMessage userMessage, string? assistantId, PromptUserContext promptUser)
        => SendStreamingMessageAsync(userId, chatId, userMessage, assistantId, promptUser, ToolSessionInput.Anonymous);

    public async Task SendStreamingMessageAsync(string userId, string chatId, Models.ChatMessage userMessage, string? assistantId, PromptUserContext promptUser, ToolSessionInput tools)
    {
        if (userMessage.Timestamp == default)
        {
            userMessage.Timestamp = DateTime.UtcNow;
        }

        // Attribution is stamped on the reply before it is written, so it survives even if the
        // conversation's assistant is switched again later. The name is snapshotted because the
        // assistant can be renamed, deleted, or unshared while this message stays in history.
        // A blank assistantId only reaches here from the overloads that pass none; those leave
        // the fields empty and the client falls back to the chat's assistant.
        var attributedAssistantId = assistantId ?? string.Empty;
        var attributedAssistantName = string.IsNullOrWhiteSpace(attributedAssistantId)
            ? string.Empty
            : (await _assistantService.GetAssistantByIdAsync(attributedAssistantId))?.Name ?? string.Empty;

        var assistantMessage = new Models.ChatMessage
        {
            Role = AiChatRole.Assistant,
            Status = AiChatStatus.Generating,
            Timestamp = userMessage.Timestamp.AddSeconds(1),
            AssistantId = attributedAssistantId,
            AssistantName = attributedAssistantName
        };

        _streamingService.StartMessage(userId, assistantMessage.Id);

        // Files still carry their content here (they came straight from the request), so
        // this is the one cheap moment to count the message for every scheme.
        var activeSchemes = await _tokenCounting.GetActiveSchemeIdsAsync();
        _tokenCounting.FillMissingMessageCounts(userMessage, activeSchemes);

        var userMessageTask = _databaseService.AddMessageAsync(userId, chatId, userMessage);
        var assistantMessageTask = _databaseService.AddMessageAsync(userId, chatId, assistantMessage);

        await Task.WhenAll(userMessageTask, assistantMessageTask);
        NotifyChatUpdated(userId, chatId);
        
        var chat = await GetChatByIdAsync(userId, chatId);
        var messages = chat?.Messages ?? new();

        var wasEmpty = messages.All(m => m.Id == userMessage.Id || m.Id == assistantMessage.Id);
        if (wasEmpty)
        {
            _ = Task.Run(async () => {
                var name = await GenerateChatNameAsync(userMessage.Content);
                if (name != null)
                {
                    await UpdateChatAsync(userId, chatId, name, null);
                }
            });
        }
        
        var effectiveAssistantId = string.IsNullOrWhiteSpace(assistantId) ? chat?.AssistantId : assistantId;
        if (chat != null && !string.IsNullOrWhiteSpace(assistantId) && assistantId != chat.AssistantId)
        {
            await UpdateChatAsync(userId, chatId, null, assistantId);
        }
        if (string.IsNullOrWhiteSpace(effectiveAssistantId))
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Assistant is required.");
            throw new InvalidOperationException("AssistantId is required for chat operations");
        }
        // Pin order is kept: pinned files are placed in the request in the order they were loaded.
        var pinnedFileIds = (chat?.LoadedFiles ?? new List<ChatLoadedFile>()).Select(f => f.FileId).Distinct().ToList();
        _logger.LogInformation("Chat {ChatId} read with {PinnedCount} pinned files", chatId, pinnedFileIds.Count);
        var resolved = await ResolveAssistantForChatAsync(userId, effectiveAssistantId, promptUser, tools.Access, pinnedFileIds);

        var modelId = resolved.Assistant.ChatSettings.Model.Id;
        var modelWithEndpoint = await _modelService.GetModelWithEndpointAsync(modelId);
        if (modelWithEndpoint == null)
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Selected model is unavailable or misconfigured.");
            throw new InvalidOperationException($"Model {modelId} not found or has no endpoint configured");
        }

        var (endpoint, model) = modelWithEndpoint.Value;

        if (!_providers.Supports(endpoint.EndpointType))
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "The selected provider is not supported.");
            throw new NotSupportedException($"No AI provider is registered for endpoint type {endpoint.EndpointType}.");
        }

        var toolContext = new ToolExecutionContext
        {
            UserId = userId,
            ChatId = chatId,
            MessageId = assistantMessage.Id,
            Access = tools.Access,
            Tokens = tools.Tokens,
            UserDisplayName = tools.UserDisplayName,
            UserPrincipalName = tools.UserPrincipalName,
            Model = model,
            Endpoint = endpoint
        };
        var request = await BuildAiRequestAsync(model, endpoint, resolved, messages, tools, toolContext);

        _ = Task.Run(async () =>
        {
            var content = new StringBuilder();
            // Owned here rather than by the runner so a failed run still leaves its partial
            // record (tool calls made, time spent) on the message.
            var activity = new MessageActivity();
            var stopwatch = Stopwatch.StartNew();

            // Without a token a run that hangs — or keeps calling tools — outlives the
            // client that started it, with no way to stop it.
            // The deadline is owned by the streaming service so a tool waiting on the user can pause it.
            using var cancellation = new CancellationTokenSource();
            _streamingService.RegisterGeneration(userId, assistantMessage.Id, cancellation, GenerationTimeout);

            try
            {
                await foreach (var chunk in _conversationRunner.StreamAsync(request, toolContext, activity, cancellation.Token))
                {
                    _streamingService.AddChunk(userId, assistantMessage.Id, chunk);

                    if (chunk.Kind == ChatStreamChunkKind.Text)
                    {
                        content.Append(chunk.Text);
                    }
                }

                // The token can fire after the last chunk but before we save. The user has already
                // been told the cancel succeeded, so the undo has to win over the success path.
                if (_streamingService.WasCancelledByUser(userId, assistantMessage.Id))
                {
                    await UndoCancelledGenerationAsync();
                    return;
                }

                assistantMessage.Content = content.ToString();
                assistantMessage.Activity = activity;
                _streamingService.CompleteMessage(userId, assistantMessage.Id);

                assistantMessage.Status = AiChatStatus.Success;
                assistantMessage.TokenCounts = _tokenCounting.CountMessage(assistantMessage, activeSchemes).Total;
                await _databaseService.UpdateMessageAsync(userId, chatId, assistantMessage);

                NotifyChatUpdated(userId, chatId);
            }
            catch (Exception ex)
            {
                if (_streamingService.WasCancelledByUser(userId, assistantMessage.Id))
                {
                    await UndoCancelledGenerationAsync();
                    return;
                }

                // A turn the provider ended early carries its reason, which the protocol has
                // already logged as status, reason and code; it is shown in place of the generic text.
                var failedText = GenerationFailedText;
                if (ex is AiTurnFailedException turnFailed)
                {
                    _logger.LogWarning("Chat completion failed: the provider ended the turn early");
                    failedText = $"*{turnFailed.Message}*";
                }
                else
                {
                    _logger.LogError(ex, "Error getting chat completion");
                }

                _streamingService.CompleteMessage(userId, assistantMessage.Id);

                var partialContent = content.ToString();
                assistantMessage.Content = string.IsNullOrWhiteSpace(partialContent)
                    ? failedText
                    : $"{partialContent}\n\n{failedText}";
                assistantMessage.Status = AiChatStatus.Error;
                AiConversationRunner.Finish(activity, stopwatch.ElapsedMilliseconds);
                assistantMessage.Activity = activity;
                assistantMessage.TokenCounts = _tokenCounting.CountMessage(assistantMessage, activeSchemes).Total;
                await _databaseService.UpdateMessageAsync(userId, chatId, assistantMessage);
                NotifyChatUpdated(userId, chatId);
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "The model failed to complete your request. Please try again.");
            }
            finally
            {
                _streamingService.UnregisterGeneration(userId, assistantMessage.Id);
            }

            // A cancel undoes the send entirely: both messages go away and the client puts the
            // text back in the composer, as if it was never sent.
            async Task UndoCancelledGenerationAsync()
            {
                _logger.LogInformation("Generation cancelled by user for message {MessageId}", assistantMessage.Id);
                _streamingService.CompleteMessage(userId, assistantMessage.Id);

                await _databaseService.DeleteMessageAsync(userId, chatId, assistantMessage.Id);
                await _databaseService.DeleteMessageAsync(userId, chatId, userMessage.Id);

                var remainingChat = await GetChatByIdAsync(userId, chatId, includeFileContent: false);
                if (remainingChat == null || remainingChat.Messages.Count == 0)
                {
                    await DeleteChatAsync(userId, chatId);
                }
                else
                {
                    NotifyChatUpdated(userId, chatId);
                }
            }
        });
    }

    public Task AddMessageAsync(string userId, string chatId, Models.ChatMessage message)
    {
        throw new NotImplementedException("AddMessageAsync is not implemented yet.");
    }

    public Task DeleteMessageAsync(string userId, string chatId, string messageId)
    {
        throw new NotImplementedException("DeleteMessageAsync is not implemented yet.");
    }

    public Task<bool> CancelGenerationAsync(string userId, string chatId, string messageId)
    {
        return Task.FromResult(_streamingService.TryCancelGeneration(userId, messageId));
    }

    #endregion Message operations

    #region AI Response

    #region Standard

    public Task<string> GetResponseAsync(string userId, string chatId, Models.ChatMessage userMessage)
    {
        throw new NotImplementedException("GetResponseAsync is not implemented yet.");
    }
    public Task<string> GetResponseAsync(string userId, string chatId)
    {
        throw new NotImplementedException("GetResponseAsync is not implemented yet.");
    }

    // AI Response without chat
    public Task<string> GetResponseAsync(string userId, ChatSettings settings, List<Models.ChatMessage> messages)
    {
        throw new NotImplementedException("GetResponseAsync is not implemented yet.");
    }

    #endregion Standard

    #region Streaming

    public Task<string> GetStreamingResponseAsync(string userId, string chatId, Models.ChatMessage userMessage)
    {
        throw new NotImplementedException("GetStreamingResponseAsync is not implemented yet.");
    }

    public Task<string> GetStreamingResponseAsync(string userId, string chatId)
    {
        throw new NotImplementedException("GetStreamingResponseAsync is not implemented yet.");
    }

    // Streaming AI Response without chat
    public Task<string> GetStreamingResponseAsync(string userId, ChatSettings settings, List<Models.ChatMessage> messages)
    {
        throw new NotImplementedException("GetStreamingResponseAsync is not implemented yet.");
    }

    #endregion Streaming

    #endregion AI Response

    #region Private helper methods

    /// <summary>
    /// The assistant a chat runs on, checked for this user, plus what the request needs from the
    /// chat: the on-demand files pinned to it, in pin order.
    /// </summary>
    private sealed record ResolvedAssistant(
        Assistant Assistant,
        bool EnforceToolAccess,
        PromptUserContext PromptUser,
        IReadOnlyList<string> PinnedFileIds);

    /// <summary>
    /// Loads the assistant with file content and refuses it when this user may not use it. Also
    /// decides whether tool policies apply at generation: never for system assistants (their own
    /// access decides who reaches them), always for private and shared ones.
    /// </summary>
    private async Task<ResolvedAssistant> ResolveAssistantForChatAsync(
        string userId,
        string assistantId,
        PromptUserContext promptUser,
        UserAccess access,
        IReadOnlyList<string> pinnedFileIds)
    {
        if (string.IsNullOrWhiteSpace(assistantId))
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Assistant is required.");
            throw new InvalidOperationException("AssistantId is required");
        }

        var assistant = await _assistantService.GetAssistantByIdAsync(assistantId, includeFileContent: true);
        if (assistant == null)
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Selected assistant is invalid.");
            throw new InvalidOperationException($"Assistant {assistantId} not found for user {userId}");
        }

        if (assistant.ChatSettings?.Model == null)
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Selected assistant has no model configured.");
            throw new InvalidOperationException($"Assistant {assistantId} has no model configured");
        }

        if (assistant.IsSystem)
        {
            if (assistant.Access != null && !assistant.Access.Allows(access))
            {
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, $"You do not have access to the assistant \"{assistant.Name}\".");
                throw new InvalidOperationException($"User {userId} may not use system assistant {assistantId}");
            }
        }
        else if (assistant.OwnerId != userId)
        {
            var disallowed = await _assistantService.DisallowedToolNamesAsync(assistant, access);
            if (disallowed.Count > 0)
            {
                await _assistantService.RemoveSharedAssistantAsync(assistantId, userId);
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Warning, AssistantService.SharedAssistantRemovedMessage(assistant, disallowed));
                throw new InvalidOperationException($"User {userId} may not use the tools on shared assistant {assistantId}");
            }
        }

        return new ResolvedAssistant(assistant, EnforceToolAccess: !assistant.IsSystem, promptUser, pinnedFileIds);
    }

    // The one place assistant settings become a provider request: capabilities are reconciled
    // once here against the live model row, so no provider has to re-derive what the model
    // will accept and the prompt never names a tool the model was not given. Tools are the
    // assistant's list cut down to what this user may use, the loader for the on-demand files
    // still loadable, plus the client's own tools. Knowledge files (always-loaded and pinned)
    // lead the history as synthetic user messages, followed by one message per knowledge source.
    private async Task<AiRequest> BuildAiRequestAsync(
        Model model,
        ModelEndpoint endpoint,
        ResolvedAssistant resolved,
        List<Models.ChatMessage> messages,
        ToolSessionInput tools,
        ToolExecutionContext toolContext)
    {
        var assistant = resolved.Assistant;
        var canLoadOnDemand = model.Capabilities.SupportsFunctionCalling;
        var pinnedFileIds = resolved.PinnedFileIds.ToHashSet(StringComparer.Ordinal);
        var onDemandFiles = KnowledgeFileMessages.Loadable(assistant.Files, pinnedFileIds);

        var settings = new ChatSettings
        {
            Model = assistant.ChatSettings.Model,
            SystemPrompt = SystemPromptAssembler.Build(
                assistant.ChatSettings.SystemPrompt,
                assistant.ChatSettings.PromptSnippets,
                resolved.PromptUser,
                assistant.Files,
                pinnedFileIds,
                canLoadOnDemand),
            Temperature = assistant.ChatSettings.Temperature,
            ReasoningEffort = assistant.ChatSettings.ReasoningEffort,
            AvailableToolIds = assistant.ChatSettings.AvailableToolIds
        };

        var parameters = ChatParameterResolver.Resolve(model.Capabilities, settings);

        var resolvedTools = new List<ITool>(resolved.EnforceToolAccess
            ? await _toolAccess.FilterAllowedAsync(parameters.ToolIds, tools.Access)
            : _toolRegistry.Resolve(parameters.ToolIds));

        if (canLoadOnDemand && onDemandFiles.Count > 0)
        {
            resolvedTools.Add(new LoadKnowledgeFileTool(assistant.Id, onDemandFiles, _databaseService, _tokenCounting, _toolOptions, _logger));
        }

        if (canLoadOnDemand && tools.ClientTools.Count > 0 && await _toolAccess.MayUseClientToolsAsync(tools.Access))
        {
            resolvedTools.AddRange(_toolRegistry.CreateClientTools(tools.ClientTools));
        }

        _logger.LogInformation(
            "Assistant {AssistantId}: {PinnedCount} pinned files ({PinnedIds}), {OnDemandCount} on-demand files offered ({OnDemandIds})",
            assistant.Id,
            pinnedFileIds.Count,
            string.Join(",", pinnedFileIds),
            onDemandFiles.Count,
            string.Join(",", onDemandFiles.Select(f => f.Id)));

        var sourceMessages = await BuildKnowledgeSourceMessagesAsync(resolved, tools, toolContext);

        return new AiRequest
        {
            Model = model,
            Endpoint = endpoint,
            SystemPrompt = settings.SystemPrompt,
            Messages = AiInputItem.From([.. KnowledgeFileMessages.Build(assistant.Files, resolved.PinnedFileIds), .. sourceMessages, .. messages]),
            Parameters = parameters,
            Tools = resolvedTools
        };
    }

    // Sources act on the user's behalf, so a caller without a delegated token gets none. Like
    // tools, system assistants are not filtered by policy: their own access decides who uses them.
    private async Task<List<Models.ChatMessage>> BuildKnowledgeSourceMessagesAsync(
        ResolvedAssistant resolved,
        ToolSessionInput tools,
        ToolExecutionContext toolContext)
    {
        var ids = resolved.Assistant.KnowledgeSourceIds;
        if (ids.Count == 0 || tools.Tokens is NoUserTokenProvider)
        {
            return [];
        }

        var sources = resolved.EnforceToolAccess
            ? _knowledgeSources.ResolveAllowed(ids, tools.Access)
            : _knowledgeSources.Resolve(ids);

        var context = new KnowledgeSourceContext
        {
            Run = toolContext,
            TimeZone = KnowledgeSourceMessages.ResolveTimeZone(tools.TimeZone),
            Now = DateTimeOffset.UtcNow
        };

        return await KnowledgeSourceMessages.BuildAsync(sources, context, _logger, CancellationToken.None);
    }

    public Task<ToolCallResponseResultDto> RespondToToolCallAsync(
        string userId,
        string chatId,
        string messageId,
        string toolCallId,
        ToolCallResponseDto response)
    {
        var awaiting = _pendingInteractions.GetPendingStatus(userId, messageId, toolCallId);
        if (awaiting == null)
        {
            return Task.FromResult(new ToolCallResponseResultDto { Accepted = false, Status = null });
        }

        var expectedKind = awaiting switch
        {
            ToolCallStatus.AwaitingConfirmation => ToolCallResponseKind.Confirmation,
            _ => ToolCallResponseKind.ClientResult
        };
        if (response.Kind != expectedKind)
        {
            throw new ArgumentException($"Tool call is awaiting {awaiting}; a {response.Kind} response does not apply.");
        }

        JsonElement? payload = null;
        if (response.Kind == ToolCallResponseKind.Confirmation && !string.IsNullOrWhiteSpace(response.EditedArgumentsJson))
        {
            try
            {
                using var document = JsonDocument.Parse(response.EditedArgumentsJson);
                if (document.RootElement.ValueKind != JsonValueKind.Object)
                {
                    throw new ArgumentException("editedArgumentsJson must be a JSON object.");
                }

                payload = document.RootElement.Clone();
            }
            catch (JsonException ex)
            {
                throw new ArgumentException($"editedArgumentsJson is not valid JSON: {ex.Message}", ex);
            }
        }
        else if (response.Kind == ToolCallResponseKind.ClientResult)
        {
            payload = JsonSerializer.SerializeToElement(response.Result ?? string.Empty);
        }

        var accepted = _pendingInteractions.TryComplete(userId, messageId, toolCallId,
            new InteractionResponse(response.Kind, response.Decision, payload, response.IsError));

        var status = accepted
            ? response.Kind switch
            {
                ToolCallResponseKind.Confirmation => response.Decision == ToolCallDecision.Approve ? ToolCallStatus.Approved : ToolCallStatus.Rejected,
                _ => response.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed
            }
            : (ToolCallStatus?)null;

        return Task.FromResult(new ToolCallResponseResultDto { Accepted = accepted, Status = status });
    }

    #endregion Private helper methods

    #region Internal methods

    // Generates a chat name using the model configured in the admin settings.
    // Returns null when no naming model is configured or it can no longer be resolved.
    private async Task<string?> GenerateChatNameAsync(string prompt)
    {
        var settings = await _settingsService.GetEffectiveAppSettingsAsync();

        if (string.IsNullOrWhiteSpace(settings.ChatNamingModelId))
        {
            _logger.LogWarning("No chat naming model configured and no models are registered. Skipping chat name generation.");
            return null;
        }

        var resolved = await _modelService.GetModelWithEndpointAsync(settings.ChatNamingModelId);
        if (resolved == null)
        {
            _logger.LogWarning("Configured chat naming model {ModelId} could not be resolved to a model and endpoint.", settings.ChatNamingModelId);
            return null;
        }

        var (endpoint, model) = resolved.Value;
        if (!_providers.Supports(endpoint.EndpointType))
        {
            _logger.LogWarning("Chat naming model {ModelId} uses unsupported endpoint type {EndpointType}.", settings.ChatNamingModelId, endpoint.EndpointType);
            return null;
        }

        // Naming is a fixed one-shot prompt: no tools, and no reasoning requested (a model
        // that always reasons still gets its lowest level via the resolver).
        var namingSettings = new ChatSettings
        {
            Model = model,
            Temperature = 1f,
            ReasoningEffort = ReasoningEffort.None
        };

        var request = new AiRequest
        {
            Model = model,
            Endpoint = endpoint,
            SystemPrompt = string.Empty,
            Messages = AiInputItem.From(new List<Models.ChatMessage>
            {
                new() { Role = AiChatRole.User, Content = ChatNamingPrompt + prompt }
            }),
            Parameters = ChatParameterResolver.Resolve(model.Capabilities, namingSettings)
        };

        try
        {
            return await _providers.For(endpoint.EndpointType).GenerateChatNameAsync(request);
        }
        catch (Exception ex)
        {
            // A failed naming call leaves the chat unnamed.
            _logger.LogWarning(ex, "Chat name generation with model {ModelId} failed.", settings.ChatNamingModelId);
            return null;
        }
    }

    private const string ChatNamingPrompt =
        "Create a name for this chat based on the users initial message. The name must be shorter than 30 characters. " +
        "Make the name as descriptive as possible. You should **only** respond with the name, exactly the way the name " +
        "should be written. It should have no quotes around it. It should not have any formating. It will be set " +
        "directly as the name of the chat. The user's message:\n\n";

    private async void SetChatName(string userId, string chatId, string prompt)
    {
        var name = await GenerateChatNameAsync(prompt);
        if (name != null)
        {
            await UpdateChatAsync(userId, chatId, null, name);
        }
    }

    private async void NotifyChatListUpdated(string userId)
    {
        await _hubContext.Clients.Group(userId).ChatListUpdated();
    }

    private async void NotifyChatUpdated(string userId, string chatId)
    {
        await _hubContext.Clients.Group(userId).ChatUpdated(chatId);
    }

    #endregion Internal methods
}
