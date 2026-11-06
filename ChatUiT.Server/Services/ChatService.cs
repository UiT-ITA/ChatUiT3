using Microsoft.AspNetCore.SignalR;
using ChatUiT.Server.Hubs;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using System.Diagnostics;
using ChatUiT.Server.Services.TokenCounting;
using ChatUiT.Server.Services.Tools;
using ChatUiT.Server.Services.Knowledge;
using System.Text;
using System.Text.Json;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using ChatUiT.Server.Telemetry;

namespace ChatUiT.Server.Services;

public class ChatService : IChatService
{
    private const string GenerationFailedText = "*The response could not be completed because an error occurred while generating it.*";
    private static readonly TimeSpan StaleGenerationThreshold = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Upper bound on a single generation, tool rounds included. Matches the threshold that
    /// marks an abandoned message as failed, so a run can never outlive its own message.
    /// </summary>
    private static readonly TimeSpan GenerationTimeout = StaleGenerationThreshold;

    /// <summary>Serialises the answers to one message's waiting calls, keyed by message id.</summary>
    private static readonly SemaphoreSlim[] MessageLocks = Enumerable.Range(0, 64).Select(_ => new SemaphoreSlim(1, 1)).ToArray();

    private readonly AiConversationRunner _conversationRunner;
    private readonly IAiProviderRegistry _providers;
    private readonly IHubContext<AppHub, IAppHubClient> _hubContext;
    private readonly AppTelemetry _telemetry;
    private readonly IDatabaseService _databaseService;
    private readonly StreamingService _streamingService;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;
    private readonly IToolRegistry _toolRegistry;
    private readonly IToolboxRegistry _toolboxes;
    private readonly IToolAccessService _toolAccess;
    private readonly ISettingsService _settingsService;
    private readonly ITokenCountingService _tokenCounting;
    private readonly ToolOptions _toolOptions;
    private readonly IKnowledgeSourceRegistry _knowledgeSources;

    public ChatService(
        AiConversationRunner conversationRunner,
        IAiProviderRegistry providers,
        IHubContext<AppHub, IAppHubClient> hubContext,
        AppTelemetry telemetry,
        IDatabaseService databaseService,
        StreamingService streamingService,
        IAssistantService assistantService,
        IModelService modelService,
        IToolRegistry toolRegistry,
        IToolboxRegistry toolboxes,
        IToolAccessService toolAccess,
        ISettingsService settingsService,
        ITokenCountingService tokenCounting,
        IOptions<ToolOptions> toolOptions,
        IKnowledgeSourceRegistry knowledgeSources)
    {
        _conversationRunner = conversationRunner;
        _providers = providers;
        _hubContext = hubContext;
        _telemetry = telemetry;
        _databaseService = databaseService;
        _streamingService = streamingService;
        _assistantService = assistantService;
        _modelService = modelService;
        _toolRegistry = toolRegistry;
        _toolboxes = toolboxes;
        _toolAccess = toolAccess;
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

    public Task<ChatHeader?> GetChatHeaderAsync(string userId, string chatId)
        => _databaseService.GetChatHeaderAsync(userId, chatId);

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

    public async Task<Chat> CreateChatAsync(string userId, string assistantId, bool redEnabled = false)
    {
        var newChat = new Chat
        {
            Name = "New chat",
            AssistantId = assistantId,
            RedEnabled = redEnabled
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

    public async Task EnableRedAsync(string userId, string chatId, string? assistantId)
    {
        await _databaseService.EnableRedAsync(userId, chatId, assistantId);
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

    public async Task SendStreamingMessageAsync(string userId, string chatId, Models.ChatMessage userMessage, string? assistantId, PromptUserContext promptUser, ToolSessionInput tools, IReadOnlyList<PendingAnswerDto>? answers = null)
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

        // Refuses a non-red assistant in a chat that allows red data, before anything is written.
        var chatHeader = await _databaseService.GetChatHeaderAsync(userId, chatId);
        var targetAssistantId = string.IsNullOrWhiteSpace(assistantId) ? chatHeader?.AssistantId : assistantId;
        var targetAssistant = string.IsNullOrWhiteSpace(targetAssistantId)
            ? null
            : await _assistantService.GetAssistantByIdAsync(targetAssistantId);
        if (chatHeader is { RedEnabled: true } && targetAssistant != null && _assistantService.ClassificationOf(targetAssistant) != DataClassification.Red)
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, $"This chat allows red data, so it can only use red assistants. \"{targetAssistant.Name}\" is not red.");
            throw new InvalidOperationException($"Chat {chatId} allows red data but assistant {targetAssistantId} is not red");
        }

        var attributedAssistantName = string.IsNullOrWhiteSpace(attributedAssistantId)
            ? string.Empty
            : targetAssistant?.Name ?? string.Empty;

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

        AiRequest request;
        ToolExecutionContext toolContext;
        try
        {
            var userMessageTask = _databaseService.AddMessageAsync(userId, chatId, userMessage);
            var assistantMessageTask = _databaseService.AddMessageAsync(userId, chatId, assistantMessage);

            await Task.WhenAll(userMessageTask, assistantMessageTask);
            NotifyChatUpdated(userId, chatId);
        
            var chat = await GetChatByIdAsync(userId, chatId);
            var messages = chat?.Messages ?? new();
            await CloseWaitingMessagesAsync(userId, chatId, messages, answers ?? [], promptUser, tools, activeSchemes);

            var wasEmpty = messages.All(m => m.Id == userMessage.Id || m.Id == assistantMessage.Id);
            if (wasEmpty)
            {
                _ = Task.Run(async () => {
                    var name = await GenerateChatNameAsync(chatId, userMessage.Content);
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
                _telemetry.ChatUpdated(chatId, null, null, assistantId);
            }
            if (string.IsNullOrWhiteSpace(effectiveAssistantId))
            {
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Assistant is required.");
                throw new InvalidOperationException("AssistantId is required for chat operations");
            }
            // Pin order is kept: pinned files are placed in the request in the order they were loaded.
            var pinnedFileIds = (chat?.LoadedFiles ?? new List<ChatLoadedFile>()).Select(f => f.FileId).Distinct().ToList();
            var resolved = await ResolveAssistantForChatAsync(userId, effectiveAssistantId, promptUser, tools.Access, pinnedFileIds);

            var modelId = resolved.Assistant.ChatSettings.Model.Id;
            var modelWithEndpoint = await _modelService.GetModelWithEndpointAsync<LanguageModel>(modelId);
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

            toolContext = new ToolExecutionContext
            {
                UserId = userId,
                ChatId = chatId,
                MessageId = assistantMessage.Id,
                Access = tools.Access,
                Tokens = tools.Tokens,
                UserDisplayName = tools.UserDisplayName,
                UserPrincipalName = tools.UserPrincipalName,
                Model = model,
                Endpoint = endpoint,
                EnforceToolAccess = resolved.EnforceToolAccess
            };

            // Knowledge sources are read once, for the first message, and saved in the chat ahead of it.
            // Later turns replay that message unchanged.
            if (wasEmpty && await BuildKnowledgeMessageAsync(resolved, tools, toolContext, userMessage, activeSchemes) is { } knowledge)
            {
                await _databaseService.AddMessageAsync(userId, chatId, knowledge);
                messages.Insert(Math.Max(0, messages.FindIndex(m => m.Id == userMessage.Id)), knowledge);
            }

            RequestFacts facts;
            (request, facts) = await BuildAiRequestAsync(model, endpoint, resolved, messages, tools);

            _telemetry.MessageSent(new MessageSentInfo(
                chatId,
                userMessage.Id,
                resolved.Assistant.Id,
                model.ModelId,
                _assistantService.ClassificationOf(resolved.Assistant).ToString(),
                request.Parameters.Effort.ToString(),
                userMessage.Files.Select(f => f.SourceFilename).ToList(),
                userMessage.Files.Select(f => FileFacts.TypeOf(f.SourceFilename) ?? string.Empty).ToList(),
                userMessage.Files.Sum(FileFacts.BytesOf),
                facts.PinnedFileIds,
                facts.OnDemandFileIds,
                facts.Toolboxes,
                facts.LoadedToolIds,
                facts.ClientToolNames,
                TokenCountingSchemes.IdFor(model.Capabilities) is { } scheme && userMessage.TokenCounts.TryGetValue(scheme, out var promptTokens) ? promptTokens : null));
        }
        catch
        {
            // Marks the reply placeholder as failed when the send fails before the run starts.
            await FailBeforeRunAsync(userId, chatId, assistantMessage);
            throw;
        }

        RunInBackground(userId, chatId, RegisterRun(userId, assistantMessage.Id, undoesSend: true), new RunPlan(assistantMessage, request, toolContext, activeSchemes)
        {
            UndoOnCancelAsync = async () =>
            {
                // A cancel undoes the send entirely: both messages go away and the client puts the
                // text back in the composer, as if it was never sent.
                await _databaseService.DeleteMessageAsync(userId, chatId, assistantMessage.Id);
                await _databaseService.DeleteMessageAsync(userId, chatId, userMessage.Id);

                var remainingChat = await GetChatByIdAsync(userId, chatId, includeFileContent: false);
                // The knowledge message alone is not a conversation.
                if (remainingChat == null || remainingChat.Messages.All(m => m.Role == AiChatRole.System))
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

    /// <summary>What one background run of an assistant message needs.</summary>
    private sealed record RunPlan(
        Models.ChatMessage AssistantMessage,
        AiRequest Request,
        ToolExecutionContext ToolContext,
        IReadOnlyList<string> ActiveSchemes)
    {
        /// <summary>The calls the message waited on, with their answers. Empty for a new message.</summary>
        public IReadOnlyList<ResumedCall> Resumes { get; init; } = [];

        /// <summary>The request with a history that holds the results of <see cref="Resumes"/>.</summary>
        public Func<AiRequest>? RequestAfterResume { get; init; }

        /// <summary>Removes the send when the user cancels. Null for a message that continues: it keeps what it had.</summary>
        public Func<Task>? UndoOnCancelAsync { get; init; }
    }

    /// <summary>
    /// Registers the run of a message so it can be cancelled and counts as active, before anything
    /// tells the client the message is generating. Without a token a run that hangs — or keeps
    /// calling tools — outlives the client that started it, with no way to stop it.
    /// </summary>
    private CancellationTokenSource RegisterRun(string userId, string messageId, bool undoesSend)
    {
        var cancellation = new CancellationTokenSource();
        _streamingService.RegisterGeneration(userId, messageId, cancellation, GenerationTimeout, undoesSend);
        return cancellation;
    }

    /// <summary>
    /// Runs the message in the background on a run registered with <see cref="RegisterRun"/>: first the
    /// waiting calls it continues, if any, then the model. Saves it as AwaitingUser when calls wait,
    /// Success when it is done, Error when the run fails.
    /// </summary>
    private void RunInBackground(string userId, string chatId, CancellationTokenSource registered, RunPlan plan)
    {
        _ = Task.Run(async () =>
        {
            var message = plan.AssistantMessage;
            var content = new StringBuilder(message.Content);
            // Owned here rather than by the runner so a failed run still leaves its partial
            // record (tool calls made, time spent) on the message.
            var activity = message.Activity ?? new MessageActivity();
            var transcript = message.Transcript ?? new List<TranscriptItem>();
            var startMs = activity.TotalMs;
            var stopwatch = Stopwatch.StartNew();
            var waiting = false;
            var stats = new RunStats();
            _telemetry.GenerationStarted(chatId, message.Id, plan.Request.Model.ModelId, plan.Request.Endpoint.EndpointType.ToString());

            using var cancellation = registered;

            try
            {
                if (plan.Resumes.Count > 0)
                {
                    await foreach (var chunk in _conversationRunner.ResumeAsync(plan.Request, plan.ToolContext, activity, transcript, plan.Resumes, cancellation.Token))
                    {
                        _streamingService.AddChunk(userId, message.Id, chunk);
                        waiting |= chunk.Kind == ChatStreamChunkKind.AwaitingUser;
                    }
                }

                if (!waiting)
                {
                    var request = plan.RequestAfterResume?.Invoke() ?? plan.Request;
                    await foreach (var chunk in _conversationRunner.StreamAsync(request, plan.ToolContext, activity, transcript, cancellation.Token, stats))
                    {
                        _streamingService.AddChunk(userId, message.Id, chunk);
                        waiting |= chunk.Kind == ChatStreamChunkKind.AwaitingUser;

                        if (chunk.Kind == ChatStreamChunkKind.Text)
                        {
                            content.Append(chunk.Text);
                        }
                    }
                }

                // The token can fire after the last chunk but before we save. The user has already
                // been told the cancel succeeded, so the undo has to win over the success path.
                if (_streamingService.WasCancelledByUser(userId, message.Id) && plan.UndoOnCancelAsync != null)
                {
                    await UndoCancelledGenerationAsync();
                    return;
                }

                message.Content = content.ToString();
                message.Activity = activity;
                message.Transcript = transcript;
                _streamingService.CompleteMessage(userId, message.Id);

                message.Status = waiting ? AiChatStatus.AwaitingUser : AiChatStatus.Success;
                message.TokenCounts = _tokenCounting.CountMessage(message, plan.ActiveSchemes).Total;
                await _databaseService.UpdateMessageAsync(userId, chatId, message);

                NotifyChatUpdated(userId, chatId);
                RecordFinished(Outcomes.Succeeded, null, waiting);
            }
            catch (Exception ex)
            {
                var cancelledByUser = _streamingService.WasCancelledByUser(userId, message.Id);
                if (cancelledByUser && plan.UndoOnCancelAsync != null)
                {
                    await UndoCancelledGenerationAsync();
                    return;
                }

                // A turn the provider ended early carries its reason, which the protocol has
                // already logged as status, reason and code; it is shown in place of the generic text.
                var failedText = GenerationFailedText;
                if (cancelledByUser)
                {
                    RecordFinished(Outcomes.Cancelled, null);
                }
                else
                {
                    if (ex is AiTurnFailedException turnFailed)
                    {
                        failedText = $"*{turnFailed.Message}*";
                    }

                    RecordFinished(Outcomes.Failed, ex);
                }

                _streamingService.CompleteMessage(userId, message.Id);

                var partialContent = content.ToString();
                message.Content = cancelledByUser
                    ? partialContent
                    : string.IsNullOrWhiteSpace(partialContent) ? failedText : $"{partialContent}\n\n{failedText}";
                message.Status = cancelledByUser ? AiChatStatus.Success : AiChatStatus.Error;
                AiConversationRunner.Finish(activity, startMs + stopwatch.ElapsedMilliseconds);
                message.Activity = activity;
                message.Transcript = transcript;
                message.TokenCounts = _tokenCounting.CountMessage(message, plan.ActiveSchemes).Total;
                await _databaseService.UpdateMessageAsync(userId, chatId, message);
                NotifyChatUpdated(userId, chatId);
                if (!cancelledByUser)
                {
                    await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "The model failed to complete your request. Please try again.");
                }
            }
            finally
            {
                _streamingService.UnregisterGeneration(userId, message.Id);
            }

            async Task UndoCancelledGenerationAsync()
            {
                RecordFinished(Outcomes.Cancelled, null);
                _streamingService.CompleteMessage(userId, message.Id);
                await plan.UndoOnCancelAsync!();
            }

            void RecordFinished(string outcome, Exception? exception, bool awaitingUser = false) =>
                _telemetry.GenerationFinished(new GenerationFinishedInfo(
                    chatId,
                    message.Id,
                    plan.Request.Model.ModelId,
                    outcome,
                    stats.ElapsedMs,
                    stats.TimeToFirstTokenMs,
                    activity.ThinkingMs,
                    activity.ToolMs,
                    activity.ToolRounds,
                    stats.ModelTurns,
                    stats.InputTokens,
                    stats.OutputTokens,
                    stats.CachedTokens,
                    stats.CacheWriteTokens,
                    stats.StopReason,
                    awaitingUser), exception);
        });
    }

    // Ends the reply's stream and stores the reply as failed.
    private async Task FailBeforeRunAsync(string userId, string chatId, Models.ChatMessage assistantMessage)
    {
        _streamingService.CompleteMessage(userId, assistantMessage.Id);

        assistantMessage.Content = GenerationFailedText;
        assistantMessage.Status = AiChatStatus.Error;
        try
        {
            await _databaseService.UpdateMessageAsync(userId, chatId, assistantMessage);
        }
        catch (Exception ex)
        {
            _telemetry.MessageStatusSaveFailed(assistantMessage.Id, ex);
        }

        NotifyChatUpdated(userId, chatId);
    }

    public Task AddMessageAsync(string userId, string chatId, Models.ChatMessage message)
    {
        throw new NotImplementedException("AddMessageAsync is not implemented yet.");
    }

    public Task DeleteMessageAsync(string userId, string chatId, string messageId)
    {
        throw new NotImplementedException("DeleteMessageAsync is not implemented yet.");
    }

    public Task<(bool Cancelled, bool Undone)> CancelGenerationAsync(string userId, string chatId, string messageId)
    {
        var cancelled = _streamingService.TryCancelGeneration(userId, messageId, out var undoesSend);
        return Task.FromResult((cancelled, cancelled && undoesSend));
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
    // toolbox loader with the assistant's toolboxes cut down to what this user may use, the
    // loader for the on-demand files still loadable, plus the client's own tools. Knowledge files
    // (always-loaded and pinned) lead the history as synthetic user messages; earlier assistant
    // messages replay their transcripts.
    /// <summary>What a request was built from, for <c>message.sent</c>.</summary>
    private sealed record RequestFacts(
        IReadOnlyList<string> PinnedFileIds,
        IReadOnlyList<string> OnDemandFileIds,
        IReadOnlyList<string> Toolboxes,
        IReadOnlyList<string> LoadedToolIds,
        IReadOnlyList<string> ClientToolNames);

    private async Task<(AiRequest Request, RequestFacts Facts)> BuildAiRequestAsync(
        LanguageModel model,
        ModelEndpoint endpoint,
        ResolvedAssistant resolved,
        List<Models.ChatMessage> messages,
        ToolSessionInput tools)
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

        var toolboxes = resolved.EnforceToolAccess
            ? await _toolAccess.FilterAllowedAsync(parameters.ToolIds, tools.Access)
            : _toolboxes.Resolve(parameters.ToolIds);
        IReadOnlyCollection<string> loadedToolIds = canLoadOnDemand ? TranscriptReplay.LoadedToolIds(messages) : Array.Empty<string>();
        var loadableTools = LoadableTools(toolboxes, loadedToolIds);

        var resolvedTools = new List<ITool>();
        if (loadableTools.Count > 0)
        {
            resolvedTools.Add(new LoadToolsTool(toolboxes, loadedToolIds, resolved.EnforceToolAccess ? _toolAccess : null));
        }

        if (canLoadOnDemand && onDemandFiles.Count > 0)
        {
            resolvedTools.Add(new LoadKnowledgeFileTool(assistant.Id, onDemandFiles, _databaseService, _tokenCounting, _toolOptions, _telemetry));
        }

        if (canLoadOnDemand)
        {
            resolvedTools.Add(new AskUserTool());
        }

        var clientTools = new List<ITool>();
        if (canLoadOnDemand && tools.ClientTools.Count > 0 && await _toolAccess.MayUseClientToolsAsync(tools.Access))
        {
            clientTools.AddRange(_toolRegistry.CreateClientTools(tools.ClientTools));
            resolvedTools.AddRange(clientTools);
        }

        var facts = new RequestFacts(
            resolved.PinnedFileIds.ToList(),
            onDemandFiles.Select(f => f.Id).ToList(),
            toolboxes.Select(t => t.Toolbox.Id).ToList(),
            loadedToolIds.ToList(),
            clientTools.Select(t => t.Id).ToList());

        var request = new AiRequest
        {
            Model = model,
            Endpoint = endpoint,
            SystemPrompt = settings.SystemPrompt,
            Messages = BuildHistory(resolved, messages, canLoadOnDemand),
            Parameters = parameters,
            Tools = resolvedTools,
            LoadableTools = loadableTools,
            LoadedToolIds = loadedToolIds
        };

        return (request, facts);
    }

    /// <summary>The knowledge files, then the messages. A model that cannot call tools gets earlier messages as text.</summary>
    private static List<AiInputItem> BuildHistory(ResolvedAssistant resolved, List<Models.ChatMessage> messages, bool canLoadOnDemand)
    {
        var history = canLoadOnDemand
            ? TranscriptReplay.ToInputItems(messages)
            : AiInputItem.From(messages);

        return [.. AiInputItem.From(KnowledgeFileMessages.Build(resolved.Assistant.Files, resolved.PinnedFileIds)), .. history];
    }

    /// <summary>
    /// Every tool of the toolboxes on offer, plus every tool a load in the history named, also when
    /// its toolbox is no longer on offer. Sorted by id.
    /// </summary>
    private List<ITool> LoadableTools(IReadOnlyList<ResolvedToolbox> toolboxes, IReadOnlyCollection<string> loadedToolIds)
    {
        var loadable = new Dictionary<string, ITool>(StringComparer.Ordinal);
        foreach (var tool in toolboxes.SelectMany(t => t.Tools))
        {
            loadable.TryAdd(tool.Id, tool);
        }

        foreach (var id in loadedToolIds)
        {
            if (!loadable.ContainsKey(id) && _toolRegistry.Find(id) is { } tool && tool.Id == id)
            {
                loadable[id] = tool;
            }
        }

        return loadable.Values.OrderBy(t => t.Id, StringComparer.Ordinal).ToList();
    }

    /// <summary>
    /// The knowledge sources as one hidden message placed just before the first user message, or
    /// null when the assistant has none or none returned anything.
    /// </summary>
    private async Task<Models.ChatMessage?> BuildKnowledgeMessageAsync(
        ResolvedAssistant resolved,
        ToolSessionInput tools,
        ToolExecutionContext toolContext,
        Models.ChatMessage userMessage,
        IReadOnlyList<string> activeSchemes)
    {
        var sources = await BuildKnowledgeSourceMessagesAsync(resolved, tools, toolContext);
        if (sources.Count == 0)
        {
            return null;
        }

        var message = new Models.ChatMessage
        {
            Role = AiChatRole.System,
            Timestamp = userMessage.Timestamp.AddSeconds(-1),
            Content = string.Join("\n\n", sources.Select(m => m.Content)),
            Status = AiChatStatus.Success,
            AssistantId = resolved.Assistant.Id
        };
        _tokenCounting.FillMissingMessageCounts(message, activeSchemes);
        return message;
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

        return await KnowledgeSourceMessages.BuildAsync(sources, context, _telemetry, CancellationToken.None);
    }

    public async Task<ToolCallResponseResultDto> RespondToToolCallAsync(
        string userId,
        string chatId,
        string messageId,
        string toolCallId,
        ToolCallResponseDto response,
        PromptUserContext promptUser,
        ToolSessionInput tools)
    {
        var messageLock = LockFor(messageId);
        await messageLock.WaitAsync();
        try
        {
            // Without file content: only the answer that continues the message needs it.
            var (chat, message, entry) = await FindWaitingCallAsync(userId, chatId, messageId, toolCallId, includeFileContent: false);
            if (chat == null || message == null || entry == null)
            {
                return new ToolCallResponseResultDto { Accepted = false };
            }

            var checkedResponse = CheckResponse(entry, response);
            entry.Response = checkedResponse;
            _telemetry.ToolResponded(chatId, messageId, entry.ToolName, ResponseName(checkedResponse));

            if (message.Activity!.Entries.Any(e => e.Status.IsAwaiting() && e.Response == null))
            {
                await _databaseService.UpdateMessageAsync(userId, chatId, message);
                NotifyChatUpdated(userId, chatId);
                return new ToolCallResponseResultDto { Accepted = true, Continued = false };
            }

            (chat, message, entry) = await FindWaitingCallAsync(userId, chatId, messageId, toolCallId, includeFileContent: true);
            if (chat == null || message == null || entry == null)
            {
                return new ToolCallResponseResultDto { Accepted = false };
            }

            entry.Response = checkedResponse;
            await ContinueMessageAsync(userId, chat, message, promptUser, tools);
            return new ToolCallResponseResultDto { Accepted = true, Continued = true };
        }
        finally
        {
            messageLock.Release();
        }
    }

    /// <summary>The <c>response</c> field of <c>tool.responded</c>: approved, rejected or answered.</summary>
    private static string ResponseName(ToolCallResponseDto response) => response.Decision switch
    {
        ToolCallDecision.Approve => "approved",
        ToolCallDecision.Reject => "rejected",
        _ => "answered"
    };

    /// <summary>The chat, the message that waits and its call that still waits under that id; nulls when there is none.</summary>
    private async Task<(Chat? Chat, Models.ChatMessage? Message, ActivityEntry? Entry)> FindWaitingCallAsync(
        string userId, string chatId, string messageId, string toolCallId, bool includeFileContent)
    {
        var chat = await GetChatByIdAsync(userId, chatId, includeFileContent);
        var message = chat?.Messages.FirstOrDefault(m => m.Id == messageId);
        var entry = message is { Role: AiChatRole.Assistant, Status: AiChatStatus.AwaitingUser }
            ? message.Activity?.Entries.FirstOrDefault(e => e.ToolCallId == toolCallId && e.Status.IsAwaiting() && e.Response == null)
            : null;
        return (chat, message, entry);
    }

    /// <summary>The response as it is kept on the entry, after checking it fits what the call waits for.</summary>
    private static ToolCallResponseDto CheckResponse(ActivityEntry entry, ToolCallResponseDto response)
    {
        var expected = entry.Status switch
        {
            ToolCallStatus.AwaitingConfirmation => ToolCallResponseKind.Confirmation,
            ToolCallStatus.AwaitingAnswer => ToolCallResponseKind.Answer,
            _ => ToolCallResponseKind.ClientResult
        };
        if (response.Kind != expected)
        {
            throw new ArgumentException($"Tool call is {entry.Status}; a {response.Kind} response does not apply.");
        }

        switch (response.Kind)
        {
            case ToolCallResponseKind.Confirmation:
                if (response.Decision == null)
                {
                    throw new ArgumentException("A confirmation needs a decision.");
                }

                string? edited = null;
                if (response.Decision == ToolCallDecision.Approve && !string.IsNullOrWhiteSpace(response.EditedArgumentsJson))
                {
                    if (entry.Preview is not { AllowEdit: true })
                    {
                        throw new ArgumentException("This call does not allow editing its arguments.");
                    }

                    edited = ParseObject(response.EditedArgumentsJson).GetRawText();
                }

                return new ToolCallResponseDto { Kind = response.Kind, Decision = response.Decision, EditedArgumentsJson = edited };

            case ToolCallResponseKind.Answer:
                if (response.Answers != null && entry.Questions != null
                    && AskUserTool.Validate(entry.Questions.Select(ToQuestion).ToList(), ToAnswers(response.Answers)) is { } problem)
                {
                    throw new ArgumentException(problem);
                }

                return new ToolCallResponseDto
                {
                    Kind = response.Kind,
                    Answers = response.Answers?.Select(a => a == null ? null : new UserAnswerDto { Selected = [.. a.Selected ?? []], Text = a.Text }).ToList()
                };

            default:
                return new ToolCallResponseDto
                {
                    Kind = response.Kind,
                    Decision = response.Decision == ToolCallDecision.Reject ? ToolCallDecision.Reject : null,
                    Result = response.Result ?? string.Empty,
                    IsError = response.IsError
                };
        }
    }

    /// <summary>What a run that continues a message needs: the request with the tools to continue its calls, and the calls with their answers.</summary>
    private sealed record Continuation(
        AiRequest Request,
        ToolExecutionContext ToolContext,
        IReadOnlyList<ResumedCall> Resumes,
        Func<AiRequest> RequestAfterResume);

    private async Task<Continuation> PrepareContinuationAsync(string userId, Chat chat, Models.ChatMessage message, PromptUserContext promptUser, ToolSessionInput tools)
    {
        var assistantId = string.IsNullOrWhiteSpace(message.AssistantId) ? chat.AssistantId : message.AssistantId;
        var resolved = await ResolveAssistantForChatAsync(userId, assistantId, promptUser, tools.Access,
            (chat.LoadedFiles ?? new List<ChatLoadedFile>()).Select(f => f.FileId).Distinct().ToList());

        var modelId = resolved.Assistant.ChatSettings.Model.Id;
        var (endpoint, model) = await _modelService.GetModelWithEndpointAsync<LanguageModel>(modelId)
            ?? throw new InvalidOperationException($"Model {modelId} not found or has no endpoint configured");

        var toolContext = new ToolExecutionContext
        {
            UserId = userId,
            ChatId = chat.Id,
            MessageId = message.Id,
            Access = tools.Access,
            Tokens = tools.Tokens,
            UserDisplayName = tools.UserDisplayName,
            UserPrincipalName = tools.UserPrincipalName,
            Model = model,
            Endpoint = endpoint,
            EnforceToolAccess = resolved.EnforceToolAccess
        };

        var messages = chat.Messages.TakeWhile(m => m.Id != message.Id).Append(message).ToList();
        var (request, _) = await BuildAiRequestAsync(model, endpoint, resolved, messages, tools);
        var resumes = message.Activity!.Entries
            .Where(e => e.Status.IsAwaiting() && e.Response != null)
            .Select(e => new ResumedCall(e, ToResumeInput(e)))
            .ToList();

        return new Continuation(request, toolContext, resumes,
            () => request with { Messages = BuildHistory(resolved, messages, model.Capabilities.SupportsFunctionCalling) });
    }

    /// <summary>Starts the run that continues a message once every call it waited on has its answer.</summary>
    private async Task ContinueMessageAsync(string userId, Chat chat, Models.ChatMessage message, PromptUserContext promptUser, ToolSessionInput tools)
    {
        var continuation = await PrepareContinuationAsync(userId, chat, message, promptUser, tools);
        var activeSchemes = await _tokenCounting.GetActiveSchemeIdsAsync();

        // Registered first, so a read of the chat never takes the generating message for an abandoned one.
        var registered = RegisterRun(userId, message.Id, undoesSend: false);
        try
        {
            message.Status = AiChatStatus.Generating;
            await _databaseService.UpdateMessageAsync(userId, chat.Id, message);
        }
        catch
        {
            _streamingService.UnregisterGeneration(userId, message.Id);
            registered.Dispose();
            throw;
        }

        _streamingService.StartMessage(userId, message.Id);
        NotifyChatUpdated(userId, chat.Id);

        RunInBackground(userId, chat.Id, registered, new RunPlan(message, continuation.Request, continuation.ToolContext, activeSchemes)
        {
            Resumes = continuation.Resumes,
            RequestAfterResume = continuation.RequestAfterResume
        });
    }

    private static ResumeInput ToResumeInput(ActivityEntry entry)
    {
        var response = entry.Response!;
        return response.Kind switch
        {
            ToolCallResponseKind.Confirmation when response.Decision == ToolCallDecision.Approve
                => new ResumeInput.Commit(ParseObject(response.EditedArgumentsJson ?? entry.ArgumentsJson ?? "{}")),
            ToolCallResponseKind.Answer when response.Answers != null
                => new ResumeInput.Answers(ToAnswers(response.Answers)),
            ToolCallResponseKind.ClientResult when response.Decision != ToolCallDecision.Reject
                => new ResumeInput.ClientResult(response.Result ?? string.Empty, response.IsError),
            _ => new ResumeInput.Declined()
        };
    }

    /// <summary>
    /// Closes every message that waits, so a new message can follow it. Calls the user answered,
    /// before or with the new message, go on with their answers: an approved action runs. Of the
    /// rest, an approval is rejected and a question is skipped; a client call stays not answered.
    /// Each message is read again under its lock, and replaces its copy in <paramref name="messages"/>.
    /// </summary>
    private async Task CloseWaitingMessagesAsync(
        string userId,
        string chatId,
        List<Models.ChatMessage> messages,
        IReadOnlyList<PendingAnswerDto> answers,
        PromptUserContext promptUser,
        ToolSessionInput tools,
        IReadOnlyList<string> activeSchemes)
    {
        foreach (var messageId in messages.Where(m => m.Status == AiChatStatus.AwaitingUser).Select(m => m.Id).ToList())
        {
            var messageLock = LockFor(messageId);
            await messageLock.WaitAsync();
            try
            {
                var chat = await GetChatByIdAsync(userId, chatId);
                var message = chat?.Messages.FirstOrDefault(m => m.Id == messageId);
                if (chat == null || message == null)
                {
                    continue;
                }

                messages[messages.FindIndex(m => m.Id == messageId)] = message;
                if (message.Status != AiChatStatus.AwaitingUser)
                {
                    continue;
                }

                var activity = message.Activity ??= new MessageActivity();
                var transcript = message.Transcript ??= new List<TranscriptItem>();
                foreach (var entry in activity.Entries.Where(e => e.Status.IsAwaiting() && e.Response == null))
                {
                    var given = answers.FirstOrDefault(a => a.ToolCallId == entry.ToolCallId);
                    entry.Response = given != null
                        ? CheckResponse(entry, given.Response)
                        : entry.Status switch
                        {
                            ToolCallStatus.AwaitingConfirmation => new ToolCallResponseDto { Kind = ToolCallResponseKind.Confirmation, Decision = ToolCallDecision.Reject },
                            ToolCallStatus.AwaitingAnswer => new ToolCallResponseDto { Kind = ToolCallResponseKind.Answer },
                            _ => null
                        };
                }

                if (activity.Entries.Any(e => e.Status.IsAwaiting() && e.Response != null))
                {
                    var continuation = await PrepareContinuationAsync(userId, chat, message, promptUser, tools);
                    await foreach (var _ in _conversationRunner.ResumeAsync(continuation.Request, continuation.ToolContext, activity, transcript, continuation.Resumes))
                    {
                    }
                }

                AiConversationRunner.LeaveUnanswered(activity, transcript);
                message.Status = AiChatStatus.Success;
                message.TokenCounts = _tokenCounting.CountMessage(message, activeSchemes).Total;
                await _databaseService.UpdateMessageAsync(userId, chatId, message);
            }
            finally
            {
                messageLock.Release();
            }
        }
    }

    private static SemaphoreSlim LockFor(string messageId)
        => MessageLocks[(uint)StringComparer.Ordinal.GetHashCode(messageId) % (uint)MessageLocks.Length];

    private static JsonElement ParseObject(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw new ArgumentException("The arguments must be a JSON object.");
            }

            return document.RootElement.Clone();
        }
        catch (JsonException ex)
        {
            throw new ArgumentException("The arguments are not valid JSON.", ex);
        }
    }

    private static UserQuestion ToQuestion(UserQuestionDto question)
        => new(question.Question, question.Options.Select(o => new UserQuestionOption(o.Label, o.Description)).ToList(), question.MultiSelect);

    private static List<UserAnswer?> ToAnswers(List<UserAnswerDto?> answers)
        => answers.Select(a => a == null ? null : new UserAnswer(a.Selected ?? [], a.Text)).ToList();

    #endregion Private helper methods

    #region Internal methods

    // Generates a chat name using the model configured in the admin settings.
    // Returns null when no naming model is configured or it can no longer be resolved.
    private async Task<string?> GenerateChatNameAsync(string chatId, string prompt)
    {
        var settings = await _settingsService.GetEffectiveAppSettingsAsync();

        if (string.IsNullOrWhiteSpace(settings.ChatNamingModelId))
        {
            _telemetry.ChatNamingUnavailable("no_model", null, null);
            return null;
        }

        var resolved = await _modelService.GetModelWithEndpointAsync<LanguageModel>(settings.ChatNamingModelId);
        if (resolved == null)
        {
            _telemetry.ChatNamingUnavailable("model_not_resolved", settings.ChatNamingModelId, null);
            return null;
        }

        var (endpoint, model) = resolved.Value;
        if (!_providers.Supports(endpoint.EndpointType))
        {
            _telemetry.ChatNamingUnavailable("endpoint_not_supported", model.ModelId, endpoint.EndpointType.ToString());
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

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var name = await _providers.For(endpoint.EndpointType).GenerateChatNameAsync(request);
            _telemetry.ChatNamed(chatId, name, model.ModelId, stopwatch.ElapsedMilliseconds, Outcomes.Succeeded);
            return name;
        }
        catch (Exception ex)
        {
            // A failed naming call leaves the chat unnamed.
            _telemetry.ChatNamed(chatId, null, model.ModelId, stopwatch.ElapsedMilliseconds, Outcomes.Failed, ex);
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
        var name = await GenerateChatNameAsync(chatId, prompt);
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
