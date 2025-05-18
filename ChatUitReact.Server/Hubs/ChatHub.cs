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
    Task ChatListUpdated(List<ChatListItemDto> chats);
    Task ReceiveMessage(string chatId, MessageDto message);
    Task ReceiveMessageChunk(string chatId, string messageId, string chunk, bool isComplete);
    Task ChatStatusUpdated(string chatId, string status);
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
                _logger.LogError(ex, "Error getting user ID from authenticated context");
                throw;
            }
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
                
                // Add connection tracking
                _connections.Add(Context.ConnectionId, userId);
                
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
            
            // Clean up connection tracking
            if (_connections.ContainsKey(Context.ConnectionId))
            {
                _connections.Remove(Context.ConnectionId);
                _logger.LogInformation("Connection {ConnectionId} removed from tracking", Context.ConnectionId);
            }
            
            await base.OnDisconnectedAsync(exception);
        }
        
        public async Task JoinChatAsync(string chatId)
        {
            try
            {
                string userId = GetCurrentUserId();
                // Get the chat to download latest state
                var chat = await _chatService.GetChatByIdAsync(userId, chatId);
                if (chat == null)
                {
                    _logger.LogWarning("Client tried to join non-existent chat: {ChatId}", chatId);
                    return;
                }
                
                // Map to DTO and send the full chat to the client
                var chatDto = chat.ToChatDto();
                
                // Send complete messages first
                var lastAssistantMessage = chatDto.Messages.LastOrDefault(m => m.Sender == "assistant");
                if (lastAssistantMessage != null)
                {
                    await Clients.Caller.ReceiveMessage(chatId, lastAssistantMessage);
                }
                
                // Check for any active or recently completed streaming messages
                var streamingMessages = _chatService.GetAllStreamingMessages(userId, chatId);
                foreach (var streamingMessage in streamingMessages)
                {
                    // Send the accumulated content for this streaming message
                    await Clients.Caller.ReceiveMessageChunk(
                        chatId,
                        streamingMessage.MessageId,
                        streamingMessage.Content,
                        streamingMessage.IsComplete
                    );
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during chat join for {ConnectionId}", Context.ConnectionId);
            }
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
            
            // Validate that at least one message exists
            if (createChatDto.Messages == null || !createChatDto.Messages.Any() ||
                createChatDto.Messages.Any(m => m.Chunks == null || !m.Chunks.Any() || 
                                            string.IsNullOrEmpty(m.Chunks.First().Content)))
            {
                throw new HubException("At least one valid message is required to create a chat");
            }
            
            // Create default settings
            var settings = new AiModelSettings();
            
            // Create the chat first
            var chat = await _chatService.CreateChatAsync(userId, createChatDto.Title, settings);
            
            // Set assistant if specified
            if (!string.IsNullOrEmpty(createChatDto.AssistantId))
            {
                chat.Assistant = new AiAssistant { Id = createChatDto.AssistantId };
            }
            
            // Process all messages in the collection
            foreach (var messageDto in createChatDto.Messages)
            {
                // Convert chunks to model format
                var messageChunks = messageDto.Chunks.Select(c => new MessageChunk
                {
                    Type = Enum.Parse<AiContentType>(c.Type, true),
                    Content = c.Content
                }).ToList();
                
                // Create the message
                var message = new AiChatMessage
                {
                    Role = AiChatRole.User,  // Default to user, could be extended to support other roles
                    Content = messageChunks,
                    Timestamp = DateTime.UtcNow,
                    Filename = messageDto.Filename
                };
                
                // Add the message to the chat
                await _chatService.AddMessageAsync(userId, chat.Id, message);
            }
            
            // Get the first user message and trigger a streaming response for it
            if (createChatDto.Messages.Any() && chat.Messages.Any(m => m.Role == AiChatRole.User))
            {
                // Take the first user message that was already added to avoid duplication
                var userMessage = chat.Messages.First(m => m.Role == AiChatRole.User);
                
                // Start streaming response asynchronously
                _ = Task.Run(async () => 
                {
                    try 
                    {
                        await _chatService.StartStreamingResponseAsync(userId, chat.Id, userMessage);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error during streaming response for chat {ChatId}", chat.Id);
                    }
                });
            }
            
            // Get the updated chat with all messages
            chat = await _chatService.GetChatByIdAsync(userId, chat.Id) ?? chat;
            
            // Map to DTO using the extension method
            return chat.ToChatDto();
        }
        
        public async Task<MessageDto?> SendMessage(CreateMessageDto createMessageDto)
        {
            string userId = GetCurrentUserId();
            
            // Validate message content
            if (createMessageDto.Chunks == null || !createMessageDto.Chunks.Any() || 
                string.IsNullOrEmpty(createMessageDto.Chunks.First().Content))
            {
                throw new HubException("Message content cannot be empty");
            }
            
            // Create text message with single chunk
            var message = new AiChatMessage
            {
                Id = Guid.NewGuid().ToString(),
                Role = AiChatRole.User,
                Timestamp = DateTime.UtcNow,
                Content = new List<MessageChunk>
                {
                    new MessageChunk
                    {
                        Type = AiContentType.Text,
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
        
        public async Task NotifyChatStatusUpdated(string chatId, string status)
        {
            string userId = GetCurrentUserId();
            await Clients.Group(userId).ChatStatusUpdated(chatId, status);
        }
        
        // Helper method that can be called by other services to notify status changes
        public async Task NotifyStatusChange(string userId, string chatId, string status)
        {
            await Clients.Group(userId).ChatStatusUpdated(chatId, status);
        }
    }
}
