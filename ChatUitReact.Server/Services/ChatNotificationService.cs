using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models.DTOs;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace ChatUitReact.Server.Services;

public class ChatNotificationService
{
    private readonly IHubContext<ChatHub> _hubContext;

    public ChatNotificationService(IHubContext<ChatHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyChatCreated(string userId, AiChatSummaryDto chat)
    {
        await _hubContext.Clients.Group(userId)
            .SendAsync("ChatCreated", chat);
    }

    public async Task NotifyChatUpdated(string userId, AiChatSummaryDto chat)
    {
        await _hubContext.Clients.Group(userId)
            .SendAsync("ChatUpdated", chat);
    }

    public async Task NotifyChatDeleted(string userId, string chatId)
    {
        await _hubContext.Clients.Group(userId)
            .SendAsync("ChatDeleted", chatId);
    }

    // Method to notify about multiple chats (useful when initializing)
    public async Task NotifyChatsListUpdated(string userId, IEnumerable<AiChatSummaryDto> chats)
    {
        await _hubContext.Clients.Group(userId)
            .SendAsync("ChatsListUpdated", chats);
    }
}
