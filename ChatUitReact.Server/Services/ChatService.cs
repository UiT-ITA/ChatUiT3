using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public class ChatService : IChatService
{
    private readonly AzureOpenAiService _azureOpenAiService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ILogger<ChatService> _logger;
    private readonly IDatabaseService _databaseService;

    public ChatService(
        AzureOpenAiService azureOpenAiService,
        IHubContext<ChatHub> hubContext,
        ILogger<ChatService> logger,
        IDatabaseService databaseService)
    {
        _azureOpenAiService = azureOpenAiService;
        _hubContext = hubContext;
        _logger = logger;
        _databaseService = databaseService;
    }

    #region Chat management

    public async Task<List<AiChatHeader>> GetChatListAsync(string userId)
    {
        return await _databaseService.GetChatListAsync(userId);
    }

    public async Task<List<AiChat>> GetChatsAsync(string userId)
    {
        var chatList = await _databaseService.GetChatListAsync(userId);

        var chats = new List<AiChat>();

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


    public async Task<AiChat?> GetChatByIdAsync(string userId, string chatId)
    {
        return await _databaseService.GetChatByIdAsync(userId, chatId);
    }


    public async Task<AiChat> CreateChatAsync(string userId, AiChatSettings settings, List<AiChatMessage> messages)
    {
        
        var newChat = new AiChat 
        {
            Name = "New chat",
            Settings = settings,
            Messages = messages,
        };

        SetChatName(userId, newChat.Id, messages[0].Content);

        var response = new AiChatMessage
        {
            Role = AiChatRole.Assistant,
            Content = "",
            Status = AiChatStatus.New
        };

        newChat.Messages.Add(response);

        await _databaseService.AddChatAsync(userId, newChat);

        NotifyChatListUpdated(userId);

        response.Content = await _azureOpenAiService.GetChatCompletionAsync(messages, settings);

        await _databaseService.UpdateMessageAsync(userId, newChat.Id, response);

        return newChat;
    }


    public async Task UpdateChatAsync(string userId, string chatId, AiChatSettings? settings, string? newTitle)
    {
        if (settings == null && newTitle == null)
        {
            return; // No changes to apply
        }

        await _databaseService.UpdateChatAsync(userId, chatId, settings, newTitle);

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

    public Task SendMessageAsync(string userId, string chatId, AiChatMessage message)
    {
        throw new NotImplementedException("SendMessageAsync is not implemented yet.");
    }

    public Task AddMessageAsync(string userId, string chatId, AiChatMessage message)
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

    public Task<string> GetResponseAsync(string userId, string chatId, AiChatMessage userMessage)
    {
        throw new NotImplementedException("GetResponseAsync is not implemented yet.");
    }
    public Task<string> GetResponseAsync(string userId, string chatId)
    {
        throw new NotImplementedException("GetResponseAsync is not implemented yet.");
    }

    // AI Response without chat
    public Task<string> GetResponseAsync(string userId, AiModelSettings settings, List<AiChatMessage> messages)
    {
        throw new NotImplementedException("GetResponseAsync is not implemented yet.");
    }

    #endregion Standard

    #region Streaming

    public Task<string> GetStreamingResponseAsync(string userId, string chatId, AiChatMessage userMessage)
    {
        throw new NotImplementedException("GetStreamingResponseAsync is not implemented yet.");
    }

    public Task<string> GetStreamingResponseAsync(string userId, string chatId)
    {
        throw new NotImplementedException("GetStreamingResponseAsync is not implemented yet.");
    }

    // Streaming AI Response without chat
    public Task<string> GetStreamingResponseAsync(string userId, AiModelSettings settings, List<AiChatMessage> messages)
    {
        throw new NotImplementedException("GetStreamingResponseAsync is not implemented yet.");
    }

    #endregion Streaming

    #endregion AI Response


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
            await _hubContext.Clients.Group(userId).SendAsync("ChatUpdated", chat);
        }
    }

    #endregion Internal methods
}