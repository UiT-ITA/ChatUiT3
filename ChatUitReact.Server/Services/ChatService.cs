using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using System.Text;

namespace ChatUitReact.Server.Services;

public class ChatService : IChatService
{
    private readonly AzureOpenAiService _azureOpenAiService;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    private readonly ILogger<ChatService> _logger;
    private readonly IDatabaseService _databaseService;
    private readonly StreamingService _streamingService;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;
    private readonly IToolService _toolService;

    public ChatService(
        AzureOpenAiService azureOpenAiService,
        IHubContext<ChatHub, IChatHubClient> hubContext,
        ILogger<ChatService> logger,
        IDatabaseService databaseService,
        StreamingService streamingService,
        IAssistantService assistantService,
        IModelService modelService,
        IToolService toolService)
    {
        _azureOpenAiService = azureOpenAiService;
        _hubContext = hubContext;
        _logger = logger;
        _databaseService = databaseService;
        _streamingService = streamingService;
        _assistantService = assistantService;
        _modelService = modelService;
        _toolService = toolService;
    }

    #region Chat management

    public async Task<List<ChatHeader>> GetChatListAsync(string userId)
    {
        return await _databaseService.GetChatListAsync(userId);
    }

    public async Task<List<Chat>> GetChatsAsync(string userId)
    {
        var chatList = await _databaseService.GetChatListAsync(userId);

        var chats = new List<Chat>();

        foreach (var chatHeader in chatList)
        {
            var chat = await _databaseService.GetChatByIdAsync(userId, chatHeader.Id);
            if (chat != null)
            {
                chats.Add(chat);
            }
        }

        return chats;
    }

    public async Task<Chat?> GetChatByIdAsync(string userId, string chatId)
    {
        return await _databaseService.GetChatByIdAsync(userId, chatId);
    }

    public async Task<Chat> CreateChatAsync(string userId, string? assistantId, List<Models.ChatMessage> messages)
    {
        var settings = await GetChatSettingsFromAssistant(userId, assistantId);
        return await CreateChatAsync(userId, settings, messages, assistantId);
    }

    public async Task<Chat> CreateChatAsync(string userId, ChatSettings settings, List<Models.ChatMessage> messages)
    {
        return await CreateChatAsync(userId, settings, messages, null);
    }

    private async Task<Chat> CreateChatAsync(string userId, ChatSettings settings, List<Models.ChatMessage> messages, string? assistantId)
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
            var name = await _azureOpenAiService.GetChatName(messages[0].Content);
            await UpdateChatAsync(userId, newChat.Id, name, null);
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

        if (newTitle != null)
        {
            NotifyChatListUpdated(userId);
        }
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

    public async Task SendStreamingMessageAsync(string userId, string chatId, Models.ChatMessage userMessage, string? assistantId)
    {
        await _databaseService.AddMessageAsync(userId, chatId, userMessage);
        
        var chat = await GetChatByIdAsync(userId, chatId);
        var messages = chat?.Messages ?? new();
        
        var effectiveAssistantId = assistantId ?? chat?.AssistantId;
        var settings = await GetChatSettingsFromAssistant(userId, effectiveAssistantId);
        
        var modelWithEndpoint = await _modelService.GetModelWithEndpointAsync(settings.Model.Id);
if (modelWithEndpoint == null)
{
    await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Selected model is unavailable or misconfigured.");
    throw new InvalidOperationException($"Model {settings.Model.Id} not found or has no endpoint configured");
}
        
        var (endpoint, model) = modelWithEndpoint.Value;
        
if (endpoint.EndpointType != EndpointType.AzureOpenAI)
{
    await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "The selected provider is not supported.");
    throw new NotSupportedException($"Provider {endpoint.EndpointType} is not supported. Only Azure OpenAI is currently supported.");
}
        
        var assistantMessage = new Models.ChatMessage
        {
            Role = AiChatRole.Assistant,
            Status = AiChatStatus.Generating
        };
        
        _streamingService.StartMessage(userId, assistantMessage.Id);
        
        await _databaseService.AddMessageAsync(userId, chatId, assistantMessage);
        
        NotifyChatUpdated(userId, chatId);

        _ = Task.Run(async () =>
        {
            try 
            {
                var content = new StringBuilder();

                await foreach (var chunk in _azureOpenAiService.StreamChatAsync(messages, settings, userId, chatId))
                {
                    if (!chunk.IsComplete)
                    {
                        _streamingService.AddChunk(userId, assistantMessage.Id, chunk.Content);
                        content.Append(chunk.Content);
                    }
                }
                
                assistantMessage.Content = content.ToString();
                _streamingService.CompleteMessage(userId, assistantMessage.Id);
                
                assistantMessage.Status = AiChatStatus.Success;
                await _databaseService.UpdateMessageAsync(userId, chatId, assistantMessage);
                
                NotifyChatUpdated(userId, chatId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting chat completion");
                assistantMessage.Status = AiChatStatus.Error;
                await _databaseService.UpdateMessageAsync(userId, chatId, assistantMessage);
                NotifyChatUpdated(userId, chatId);
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "The model failed to complete your request. Please try again.");
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

    private async Task<ChatSettings> GetChatSettingsFromAssistant(string userId, string? assistantId)
    {
        if (!string.IsNullOrEmpty(assistantId))
        {
            var assistant = await _assistantService.GetAssistantByIdAsync(assistantId);
            if (assistant == null)
            {
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Selected assistant is invalid.");
                throw new InvalidOperationException($"Assistant {assistantId} not found for user {userId}");
            }
            
            if (assistant.Model == null)
            {
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "Selected assistant has no model configured.");
                throw new InvalidOperationException($"Assistant {assistantId} has no model configured");
            }
            
            return new ChatSettings 
            { 
                Model = assistant.Model,
                SystemPrompt = assistant.ChatSettings?.SystemPrompt ?? string.Empty,
                Temperature = assistant.ChatSettings?.Temperature ?? 0.7f,
                ReasoningEffort = assistant.ChatSettings?.ReasoningEffort ?? ReasoningEffort.Medium,
            AvailableToolIds = assistant.ChatSettings?.AvailableToolIds ?? new List<string>()
            };
        }
        
        // Get default model for when no assistant is specified
        var defaultModels = await _modelService.GetAllModelsAsync();
        var defaultModel = defaultModels.FirstOrDefault(m => m.ModelName == "gpt-4o");
        
        if (defaultModel == null)
        {
            defaultModel = defaultModels.FirstOrDefault();
            if (defaultModel == null)
            {
                await _hubContext.Clients.Group(userId).Notify(NotifyLevel.Error, "No models are configured. Please contact the administrator.");
                throw new InvalidOperationException("No models available in the system");
            }
        }
        
        return new ChatSettings { Model = defaultModel };
    }

    #endregion Private helper methods

    #region Internal methods

    private async void SetChatName(string userId, string chatId, string prompt)
    {
        var name = await _azureOpenAiService.GetChatName(prompt);
        await UpdateChatAsync(userId, chatId, null, name);
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
