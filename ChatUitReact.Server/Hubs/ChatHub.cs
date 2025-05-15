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

public interface IChatHubClient
{
    /// <summary>
    /// Receive an updated list of chats for the sidebar
    /// </summary>
    Task ChatListUpdated(List<ChatListItemDto> chats);
    
    /// <summary>
    /// Receive a new message for a specific chat
    /// </summary>
    Task ReceiveMessage(string chatId, MessageDto message);
    
    /// <summary>
    /// Receive a chunk of a message for streaming
    /// </summary>
    Task ReceiveMessageChunk(string chatId, string messageId, string chunk, bool isComplete);
}

namespace ChatUitReact.Server.Hubs
{
    [Authorize]
    public class ChatHub : Hub<IChatHubClient>
    {
    private readonly UserService _userService;
    private readonly ILogger<ChatHub> _logger;
    private readonly IChatService _chatService;

    public ChatHub(
        UserService userService, 
        ILogger<ChatHub> logger,
        IChatService chatService)
        {
            _userService = userService;
            _logger = logger;
            _chatService = chatService;
        }

        /// <summary>
        /// Gets the current user ID from the connection context
        /// </summary>
        private string GetCurrentUserId()
        {
            try
            {
                if (Context.User?.Identity?.IsAuthenticated == true)
                {
                    return _userService.GetCurrentUserId(Context.User);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error getting user ID, using anonymous");
            }
            
            return "anonymous";
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                string userId = GetCurrentUserId();

                _logger.LogInformation("User connected to ChatHub: {UserId}, ConnectionId: {ConnectionId}",
                    userId, Context.ConnectionId);

                // Add to a user-specific group for targeted notifications
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
                
                // Send the current chat list to the connected client
                var chats = await _chatService.GetChatsAsync(userId);
                var chatDtos = chats.Select(chat => new ChatListItemDto 
                {
                    Id = chat.Id,
                    Title = chat.Name,
                    LastUpdated = chat.UpdatedAt,
                    AssistantId = chat.Assistant?.Id
                }).ToList();
                
                await Clients.Caller.ChatListUpdated(chatDtos);

                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnConnectedAsync");
                throw;
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            string userId = GetCurrentUserId();

            _logger.LogInformation("User disconnected from ChatHub: {UserId}, ConnectionId: {ConnectionId}",
                userId, Context.ConnectionId);

            // Remove from user-specific group
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            await base.OnDisconnectedAsync(exception);
        }
        
        public async Task<List<ChatListItemDto>> GetChats()
        {
            string userId = GetCurrentUserId();
            var chats = await _chatService.GetChatsAsync(userId);
            
            // Map domain models to DTOs for client
            return chats.Select(chat => new ChatListItemDto
            {
                Id = chat.Id,
                Title = chat.Name,
                LastUpdated = chat.UpdatedAt,
                AssistantId = chat.Assistant?.Id
            }).ToList();
        }
        
        public async Task<ChatDto> CreateChat(CreateChatDto createChatDto)
        {
            string userId = GetCurrentUserId();
            
            // Create default settings
            var settings = new AiModelSettings();
            
            // Use an appropriate initial message
            var initialMessage = "Hello! I'm starting a new conversation.";
            
            var chat = await _chatService.CreateChatAsync(userId, initialMessage, settings);
            
            // Map to DTO
            return new ChatDto
            {
                Id = chat.Id,
                Title = chat.Name,
                CreatedAt = chat.CreatedAt,
                LastUpdated = chat.UpdatedAt,
                AssistantId = chat.Assistant?.Id,
                Messages = chat.Messages.Select(m => m.ToMessageDto()).ToList()
            };
        }
        
        public async Task<MessageDto?> SendMessage(CreateMessageDto createMessageDto)
        {
            string userId = GetCurrentUserId();
            
            // Create text message with single chunk
            var message = new AiChatMessage
            {
                Role = AiChatRole.User,
                Content = new List<MessageChunk>
                {
                    new MessageChunk
                    {
                        Type = AiMessageChunkType.Text,
                        Content = createMessageDto.Chunks.First().Content
                    }
                }
            };
            
            var result = await _chatService.AddMessageAsync(userId, createMessageDto.ChatId, message);
            
            // Map to DTO using extension method
            return result.ToMessageDto();
        }
        
        public async Task<ChatListItemDto?> UpdateChatTitle(string chatId, string newTitle)
        {
            string userId = GetCurrentUserId();
            var chat = await _chatService.RenameChatAsync(userId, chatId, newTitle);
            
            if (chat == null) return null;
            
            // Map to DTO
            return new ChatListItemDto
            {
                Id = chat.Id,
                Title = chat.Name,
                LastUpdated = chat.UpdatedAt,
                AssistantId = chat.Assistant?.Id
            };
        }
        
        public async Task<bool> DeleteChat(string chatId)
        {
            string userId = GetCurrentUserId();
            return await _chatService.DeleteChatAsync(userId, chatId);
        }
        
        // Using ToMessageDto extension method now
    }
}
