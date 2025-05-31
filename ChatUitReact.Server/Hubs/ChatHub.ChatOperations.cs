using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Hubs;

public partial class ChatHub
{
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

    public void StreamMessage(string chatId, string messageId)
    {
        var userId = GetCurrentUserId();
        var clientId = Context.ConnectionId;

        _ = _streamingMessageService.StreamToClient(clientId, userId, chatId, messageId, 
            async (cId, mId, chunk) => await _hubContext.Clients.Client(clientId).SendAsync("ReceiveMessageChunk", cId, mId, chunk));
    }

    public async Task SendMessage(string chatId, string content, string? assistantId = null)
    {
        // Console.WriteLine($"SendMessage called with chatId: {chatId}, content: {content}, assistantId: {assistantId}");
        var userId = GetCurrentUserId();
        
        if (chatId == "new")
        {
            var messages = new List<AiChatMessage>
            {
                new AiChatMessage
                {
                    Role = AiChatRole.User,
                    Content = content,
                    Status = AiChatStatus.Success
                }
            };
            
            var chat = await _chatService.CreateChatAsync(userId, assistantId, messages);
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
            }, assistantId);

            var chat = await _chatService.GetChatByIdAsync(userId, chatId);
            if (chat != null)
            {
                await Clients.Group($"{userId}:{chatId}").ChatUpdated(chat);
            }
        }
    }
}
