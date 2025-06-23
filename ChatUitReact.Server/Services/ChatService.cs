using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using System.Text;
using System.ClientModel;
using OpenAI.Chat;

namespace ChatUitReact.Server.Services;

public class ChatService : IChatService
{
    private readonly AzureOpenAiService _azureOpenAiService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ILogger<ChatService> _logger;
    private readonly IDatabaseService _databaseService;
    private readonly StreamingMessageService _streamingMessageService;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;

    public ChatService(
        AzureOpenAiService azureOpenAiService,
        IHubContext<ChatHub> hubContext,
        ILogger<ChatService> logger,
        IDatabaseService databaseService,
        StreamingMessageService streamingMessageService,
        IAssistantService assistantService,
        IModelService modelService)
    {
        _azureOpenAiService = azureOpenAiService;
        _hubContext = hubContext;
        _logger = logger;
        _databaseService = databaseService;
        _streamingMessageService = streamingMessageService;
        _assistantService = assistantService;
        _modelService = modelService;
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
        // Add user message to database
        await _databaseService.AddMessageAsync(userId, chatId, userMessage);
        
        // Create placeholder for assistant's response
        var assistantMessage = new Models.ChatMessage
        {
            Role = AiChatRole.Assistant,
            Status = AiChatStatus.Generating
        };
        await _databaseService.AddMessageAsync(userId, chatId, assistantMessage);
        
        // Notify all clients about new messages
        NotifyChatUpdated(userId, chatId);

        // Get AI response (fire and forget)
        _ = Task.Run(async () =>
        {
            try 
            {
                var chat = await GetChatByIdAsync(userId, chatId);
                var messages = chat?.Messages ?? new();
                
                // Get AI settings - use the assistant from the chat or the provided one
                var effectiveAssistantId = assistantId ?? chat?.AssistantId;
                var settings = await GetChatSettingsFromAssistant(userId, effectiveAssistantId);
                
                // Validate provider and get endpoint information
                var modelWithEndpoint = await _modelService.GetModelWithEndpointAsync(settings.Model.Id);
                if (modelWithEndpoint == null)
                {
                    throw new InvalidOperationException($"Model {settings.Model.Id} not found or has no endpoint configured");
                }
                
                var (endpoint, model) = modelWithEndpoint.Value;
                
                // Validate that we're using Azure OpenAI provider
                if (endpoint.EndpointType != EndpointType.AzureOpenAI)
                {
                    throw new NotSupportedException($"Provider {endpoint.EndpointType} is not supported. Only Azure OpenAI is currently supported.");
                }
                
                var openAiStream = _azureOpenAiService.GetChatCompletionStreamingAsync(messages, settings.Model, settings);
                
                // Create our custom streaming channel
                var chunkChannel = new StreamingChunkChannel();
                
                // Start the streaming service with our custom stream
                _streamingMessageService.StartStream(userId, chatId, assistantMessage.Id, chunkChannel.ReadAllChunks());
                
                // Process incoming chunks from OpenAI and write to our channel
                var content = new StringBuilder();
                await foreach (var chunk in openAiStream)
                {
                    if (chunk.ContentUpdate?.Count > 0)
                    {
                        var text = chunk.ContentUpdate[0].Text;
                        if (!string.IsNullOrEmpty(text))
                        {
                            // Write to our channel for streaming clients
                            await chunkChannel.WriteChunk(text);
                            
                            // Collect for database storage
                            content.Append(text);
                        }
                    }
                }
                
                // Mark the channel as complete
                chunkChannel.Complete();
                
                // Update assistant message with complete response
                assistantMessage.Content = content.ToString();
                
                assistantMessage.Status = AiChatStatus.Success;
                await _databaseService.UpdateMessageAsync(userId, chatId, assistantMessage);
                
                // Notify all clients about updated message
                NotifyChatUpdated(userId, chatId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting chat completion");
                assistantMessage.Status = AiChatStatus.Error;
                await _databaseService.UpdateMessageAsync(userId, chatId, assistantMessage);
                NotifyChatUpdated(userId, chatId);
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
                throw new InvalidOperationException($"Assistant {assistantId} not found for user {userId}");
            }
            
            if (assistant.Model == null)
            {
                throw new InvalidOperationException($"Assistant {assistantId} has no model configured");
            }
            
            return new ChatSettings 
            { 
                Model = assistant.Model,
                SystemPrompt = assistant.ChatSettings?.SystemPrompt ?? string.Empty,
                Temperature = assistant.ChatSettings?.Temperature ?? 0.7f,
                ReasoningEffort = assistant.ChatSettings?.ReasoningEffort ?? ReasoningEffort.Medium
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
        var chatList = await GetChatListAsync(userId);
        await _hubContext.Clients.Group(userId).SendAsync("ChatListUpdated", chatList);
    }

    private async void NotifyChatUpdated(string userId, string chatId)
    {
        var chat = await GetChatByIdAsync(userId, chatId);

        if (chat != null)
        {
            await _hubContext.Clients.Group($"{userId}:{chatId}").SendAsync("ChatUpdated", chatId);
        }
    }

    #endregion Internal methods
}
