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

namespace ChatUitReact.Server.Hubs
{
public interface IChatHubClient
{
    Task ChatListUpdated(List<AiChatHeader> chats);
    Task ReceiveMessage(string message);
}
    
    [Authorize]
    public class ChatHub : Hub<IChatHubClient>
    {
    private readonly UserService _userService;
    private readonly ILogger<ChatHub> _logger;
    private readonly IChatService _chatService;
    
    // Chat status constants
    public const string ChatStatusIdle = "idle";
    public const string ChatStatusStreaming = "streaming";
    public const string ChatStatusUpdated = "updated";
    
    // Track active connections for user
    private static readonly Dictionary<string, string> _connections = new Dictionary<string, string>();

    public ChatHub(
        UserService userService, 
        ILogger<ChatHub> logger,
        IChatService chatService)
        {
            _userService = userService;
            _logger = logger;
            _chatService = chatService;
        }
        

        private string GetCurrentUserId()
        {
            try
            {
                if (Context.User?.Identity?.IsAuthenticated == true)
                {
                    return _userService.GetCurrentUserId(Context.User);
                }
                throw new UnauthorizedAccessException("User must be authenticated");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ChatHub] Error getting user ID from authenticated context");
                throw;
            }
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                string userId = GetCurrentUserId();

                _logger.LogInformation("[ChatHub] User connected: {UserId}, ConnectionId: {ConnectionId}", userId, Context.ConnectionId);


                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
                
                var chats = await _chatService.GetChatListAsync(userId);
               
                await Clients.Caller.ChatListUpdated(chats);
                
                _connections.Add(Context.ConnectionId, userId);
                
                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ChatHub] Error in OnConnectedAsync");
                throw;
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            string userId = GetCurrentUserId();

            _logger.LogInformation("[ChatHub] User disconnected: {UserId}, ConnectionId: {ConnectionId}",
                userId, Context.ConnectionId);

            // Remove from user-specific group
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            
            // Clean up connection tracking
            if (_connections.ContainsKey(Context.ConnectionId))
            {
                _connections.Remove(Context.ConnectionId);
                _logger.LogInformation("Connection {ConnectionId} removed from tracking", Context.ConnectionId);
            }
            
            await base.OnDisconnectedAsync(exception);
        }






        // old, for reference only

        public Task JoinChatAsync(string chatId)
        {

            //try
            //{
            //    string userId = GetCurrentUserId();
            //    // Get the chat to download latest state
            //    var chat = await _chatService.GetChatByIdAsync(userId, chatId);
            //    if (chat == null)
            //    {
            //        _logger.LogWarning("Client tried to join non-existent chat: {ChatId}", chatId);
            //        return;
            //    }
                
            //    // Map to DTO and send the full chat to the client
            //    var chatDto = chat.ToChatDto();
                
            //    // Send complete messages first
            //    var lastAssistantMessage = chatDto.Messages.LastOrDefault(m => m.Sender == "assistant");
            //    if (lastAssistantMessage != null)
            //    {
            //        await Clients.Caller.ReceiveMessage(chatId, lastAssistantMessage);
            //    }
                
            //    // Check for any active or recently completed streaming messages
            //    var streamingMessages = _chatService.GetAllStreamingMessages(userId, chatId);
            //    foreach (var streamingMessage in streamingMessages)
            //    {
            //        // Send the accumulated content for this streaming message
            //        await Clients.Caller.ReceiveMessageChunk(
            //            chatId,
            //            streamingMessage.MessageId,
            //            streamingMessage.Content,
            //            streamingMessage.IsComplete
            //        );
            //    }
            //}
            //catch (Exception ex)
            //{
            //    _logger.LogError(ex, "Error during chat join for {ConnectionId}", Context.ConnectionId);
            //}

            throw new NotImplementedException("JoinChatAsync is not implemented yet.");
        }
        
        public Task<List<AiChatHeader>> GetChats()
        {
            //string userId = GetCurrentUserId();
            //var chats = await _chatService.GetChatsAsync(userId);
            
            //// Map domain models to DTOs for client
            //return chats.Select(chat => new ChatListItemDto
            //{
            //    Id = chat.Id,
            //    Title = chat.Name,
            //    LastUpdated = chat.UpdatedAt,
            //    AssistantId = chat.Assistant?.Id
            //}).ToList();
            throw new NotImplementedException("GetChats is not implemented yet.");
        }
        
        public Task CreateChat()
        {
            throw new NotImplementedException("CreateChat is not implemented yet.");
        }
        
        public Task SendMessage()
        {
            throw new NotImplementedException("SendMessage is not implemented yet.");
        }
        
    }
}
