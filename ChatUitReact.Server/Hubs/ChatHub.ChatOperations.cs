using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Hubs;

public partial class ChatHub
{
    public async Task JoinChat(string chatId)
    {
        var userId = GetCurrentUserId();
        var chat = await _chatService.GetChatByIdAsync(userId, chatId);
        if (chat == null)
        {
            await Clients.Caller.Error("Chat not found");
            return;
        }

        var groupName = $"{userId}:{chatId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task LeaveChat(string chatId)
    {
        var userId = GetCurrentUserId();
        var groupName = $"{userId}:{chatId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }

    public void StreamMessage(string chatId, string messageId)
    {
        var userId = GetCurrentUserId();
        var clientId = Context.ConnectionId;

        _ = _streamingMessageService.StreamToClient(clientId, userId, chatId, messageId, 
            async (cId, mId, chunk) => await _hubContext.Clients.Client(clientId).SendAsync("ReceiveMessageChunk", cId, mId, chunk));
    }

}
