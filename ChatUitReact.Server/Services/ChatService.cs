using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;
using System.Text;

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
    private readonly IToolService _toolService;
    private readonly ISettingsService _settingsService;

    public ChatService(
        AiConversationRunner conversationRunner,
        IAiProviderRegistry providers,
        IHubContext<ChatHub, IChatHubClient> hubContext,
        ILogger<ChatService> logger,
        IDatabaseService databaseService,
        StreamingService streamingService,
        IAssistantService assistantService,
        IModelService modelService,
        IToolService toolService,
        ISettingsService settingsService)
    {
        _conversationRunner = conversationRunner;
        _providers = providers;
        _hubContext = hubContext;
        _logger = logger;
        _databaseService = databaseService;
        _streamingService = streamingService;
        _assistantService = assistantService;
        _modelService = modelService;
        _toolService = toolService;
        _settingsService = settingsService;
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
                DateTime.UtcNow - message.Timestamp < StaleGenerationThreshold)
            {
                continue;
            }

            message.Status = AiChatStatus.Error;
            message.Content = string.IsNullOrWhiteSpace(message.Content)
                ? GenerationFailedText
                : $"{message.Content}\n\n{GenerationFailedText}";

            // Persist through a copy without files: an empty file list keeps the stored
            // files untouched, which matters when this chat was loaded metadata-only.
            await _databaseService.UpdateMessageAsync(userId, chatId, new Models.ChatMessage
            {
                Id = message.Id,
                Role = message.Role,
                Timestamp = message.Timestamp,
                Status = message.Status,
                Content = message.Content,
                Files = new List<ChatFile>()
            });
        }

        return chat;
    }

    public async Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId)
    {
        return await _databaseService.GetChatFileAsync(userId, chatId, fileId);
    }

    public async Task<Chat> CreateChatAsync(string userId, string assistantId, List<Models.ChatMessage> messages)
    {
        return await CreateChatAsync(userId, messages, assistantId);
    }


    private async Task<Chat> CreateChatAsync(string userId, List<Models.ChatMessage> messages, string assistantId)
    {
        var lastMessage = messages.Last();
        var initialMessages = messages.Take(messages.Count - 1).ToList();

        var newChat = new Chat 
        {
            Name = "New chat",
            AssistantId = assistantId,
            Messages = initialMessages
        };

        await _databaseService.AddChatAsync(userId, newChat);
        NotifyChatListUpdated(userId);

        _ = Task.Run(async () => {
            var name = await GenerateChatNameAsync(messages[0].Content);
            if (name != null)
            {
                await UpdateChatAsync(userId, newChat.Id, name, null);
            }
        });

        await SendStreamingMessageAsync(userId, newChat.Id, lastMessage, assistantId);

        return newChat;
    }

    public async Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null)
    {
        if (newTitle == null && newAssistantId == null)
        {
            return; // No changes to apply
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

    public async Task SendMessageAsync(string userId, string chatId, Models.ChatMessage message)
    {
        await SendStreamingMessageAsync(userId, chatId, message);
    }

    public async Task SendMessageAsync(string userId, string chatId, Models.ChatMessage message, string? assistantId)
    {
        await SendStreamingMessageAsync(userId, chatId, message, assistantId);
    }

    public async Task SendStreamingMessageAsync(string userId, string chatId, Models.ChatMessage userMessage)
    {
        await SendStreamingMessageAsync(userId, chatId, userMessage, null);
    }

    public async Task SendStreamingMessageAsync(string userId, string chatId, Models.ChatMessage userMessage, string assistantId)
    {
        if (userMessage.Timestamp == default)
        {
            userMessage.Timestamp = DateTime.UtcNow;
        }

        var assistantMessage = new Models.ChatMessage
        {
            Role = AiChatRole.Assistant,
            Status = AiChatStatus.Generating,
            Timestamp = userMessage.Timestamp.AddSeconds(1)
        };

        _streamingService.StartMessage(userId, assistantMessage.Id);

        var userMessageTask = _databaseService.AddMessageAsync(userId, chatId, userMessage);
        var assistantMessageTask = _databaseService.AddMessageAsync(userId, chatId, assistantMessage);

        await Task.WhenAll(userMessageTask, assistantMessageTask);
        NotifyChatUpdated(userId, chatId);
        
        var chat = await GetChatByIdAsync(userId, chatId);
        var messages = chat?.Messages ?? new();
        
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
        var settings = await GetChatSettingsFromAssistant(userId, effectiveAssistantId);
        
        var modelWithEndpoint = await _modelService.GetModelWithEndpointAsync(settings.Model.Id);
        if (modelWithEndpoint == null)
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Selected model is unavailable or misconfigured.");
            throw new InvalidOperationException($"Model {settings.Model.Id} not found or has no endpoint configured");
        }

        var (endpoint, model) = modelWithEndpoint.Value;

        if (!_providers.Supports(endpoint.EndpointType))
        {
            await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "The selected provider is not supported.");
            throw new NotSupportedException($"No AI provider is registered for endpoint type {endpoint.EndpointType}.");
        }

        var request = BuildAiRequest(model, endpoint, settings, messages);

        _ = Task.Run(async () =>
        {
            var content = new StringBuilder();

            // Without a token a run that hangs — or keeps calling tools — outlives the
            // client that started it, with no way to stop it.
            using var cancellation = new CancellationTokenSource(GenerationTimeout);
            _streamingService.RegisterGeneration(userId, assistantMessage.Id, cancellation);

            try
            {
                await foreach (var chunk in _conversationRunner.StreamAsync(request, userId, chatId, cancellation.Token))
                {
                    if (!chunk.IsComplete)
                    {
                        _streamingService.AddChunk(userId, assistantMessage.Id, chunk.Content);
                        content.Append(chunk.Content);
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
                _streamingService.CompleteMessage(userId, assistantMessage.Id);

                assistantMessage.Status = AiChatStatus.Success;
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

                _logger.LogError(ex, "Error getting chat completion");
                _streamingService.CompleteMessage(userId, assistantMessage.Id);

                var partialContent = content.ToString();
                assistantMessage.Content = string.IsNullOrWhiteSpace(partialContent)
                    ? GenerationFailedText
                    : $"{partialContent}\n\n{GenerationFailedText}";
                assistantMessage.Status = AiChatStatus.Error;
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

    private async Task<ChatSettings> GetChatSettingsFromAssistant(string userId, string assistantId)
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

        return new ChatSettings
        {
            Model = assistant.ChatSettings.Model,
            SystemPrompt = AppendKnowledgeFiles(assistant.ChatSettings.SystemPrompt, assistant.Files),
            Temperature = assistant.ChatSettings.Temperature,
            ReasoningEffort = assistant.ChatSettings.ReasoningEffort,
            AvailableToolIds = assistant.ChatSettings.AvailableToolIds
        };
    }

    // The one place assistant settings become a provider request: capabilities are reconciled
    // once here, so no provider has to re-derive what the model will accept.
    private AiRequest BuildAiRequest(
        Model model,
        ModelEndpoint endpoint,
        ChatSettings settings,
        List<Models.ChatMessage> messages)
    {
        var parameters = ChatParameterResolver.Resolve(model.Capabilities, settings);

        return new AiRequest
        {
            Model = model,
            Endpoint = endpoint,
            SystemPrompt = settings.SystemPrompt,
            Messages = messages,
            Parameters = parameters,
            Tools = _toolService.GetToolDefinitions(parameters.ToolIds).ToList()
        };
    }

    private static string AppendKnowledgeFiles(string systemPrompt, List<AssistantFile> files)
    {
        // Only always-loaded files go into the system message, and only their text
        // content — images cannot be carried in a system message.
        var builder = new StringBuilder();
        foreach (var file in files.Where(f => f.Category == AssistantFileCategories.AlwaysLoaded))
        {
            var text = string.Concat(file.Chunks
                .Where(chunk => chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                .Select(chunk => chunk.Text));

            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            builder.AppendLine();
            builder.AppendLine();
            builder.AppendLine($"## {file.SourceFilename}");
            builder.AppendLine(text);
        }

        if (builder.Length == 0)
        {
            return systemPrompt;
        }

        var knowledgeSection = "# Knowledge files" + builder;
        return string.IsNullOrWhiteSpace(systemPrompt)
            ? knowledgeSection
            : $"{systemPrompt}\n\n{knowledgeSection}";
    }

    #endregion Private helper methods

    #region Internal methods

    // Generates a chat name using the model configured in the admin settings.
    // Returns null when no naming model is configured or it can no longer be resolved.
    private async Task<string?> GenerateChatNameAsync(string prompt)
    {
        var settings = await _settingsService.GetAppSettingsAsync();

        if (string.IsNullOrWhiteSpace(settings.ChatNamingModelId))
        {
            _logger.LogInformation("No chat naming model configured. Skipping chat name generation.");
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
            Messages = new List<Models.ChatMessage>
            {
                new() { Role = AiChatRole.User, Content = ChatNamingPrompt + prompt }
            },
            Parameters = ChatParameterResolver.Resolve(model.Capabilities, namingSettings)
        };

        return await _providers.For(endpoint.EndpointType).CompleteTextAsync(request);
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
