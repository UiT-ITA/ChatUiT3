using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using ChatUitReact.Server.Models.DTOs;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Extentions;

namespace ChatUitReact.Server.Hubs;

public interface IChatHubClient
{
    Task ChatListUpdated(List<AiChatHeader> chats);
    Task ChatUpdated(AiChat chat);
    Task ReceiveMessageChunk(string chatId, string messageId, string chunk);
    Task ChatCreated(string chatId);
}

[Authorize]
public class ChatHub : Hub<IChatHubClient>
{
    private readonly UserService _userService;
    private readonly ILogger<ChatHub> _logger;
    private readonly IChatService _chatService;
    private static readonly Dictionary<string, string> _connections = new Dictionary<string, string>();

    public ChatHub(UserService userService, ILogger<ChatHub> logger, IChatService chatService)
    {
        _userService = userService;
        _logger = logger;
        _chatService = chatService;
    }

    private string GetCurrentUserId()
    {
        if (Context.User?.Identity?.IsAuthenticated == true)
        {
            return _userService.GetCurrentUserId(Context.User);
        }
        throw new UnauthorizedAccessException("User must be authenticated");
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        var chats = await _chatService.GetChatListAsync(userId);
        await Clients.Caller.ChatListUpdated(chats);
        _connections.Add(Context.ConnectionId, userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetCurrentUserId();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
        if (_connections.ContainsKey(Context.ConnectionId))
        {
            _connections.Remove(Context.ConnectionId);
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinChat(string chatId)
    {
        var userId = GetCurrentUserId();
        var groupName = $"{userId}:{chatId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        var chat = await _chatService.GetChatByIdAsync(userId, chatId);
        if (chat == null)
        {
            throw new HubException("ChatNotFound");
        }

        await Clients.Caller.ChatUpdated(chat);
    }

    public async Task LeaveChat(string chatId)
    {
        var userId = GetCurrentUserId();
        var groupName = $"{userId}:{chatId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task SendMessage(string chatId, string content)
    {
        var userId = GetCurrentUserId();
        
        if (chatId == "new")
        {
            var settings = new AiChatSettings { Model = new AiModel { ModelId = "gpt-4o" } };
            var messages = new List<AiChatMessage>
            {
                new AiChatMessage
                {
                    Role = AiChatRole.User,
                    Content = content,
                    Status = AiChatStatus.Success
                }
            };
            
            var chat = await _chatService.CreateChatAsync(userId, settings, messages);
            _logger.LogInformation("Created new chat with ID: {ChatId}", chat.Id);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"{userId}:{chat.Id}");
            await Clients.Caller.ChatCreated(chat.Id);
        }
        else
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"{userId}:{chatId}");
            await _chatService.SendStreamingMessageAsync(userId, chatId, new AiChatMessage
            {
                Role = AiChatRole.User,
                Content = content,
                Status = AiChatStatus.Success
            });

            var chat = await _chatService.GetChatByIdAsync(userId, chatId);
            if (chat != null)
            {
                await Clients.Group($"{userId}:{chatId}").ChatUpdated(chat);
            }
        }
    }
}
