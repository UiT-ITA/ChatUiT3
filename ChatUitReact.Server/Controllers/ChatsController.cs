using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Extentions;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatsController : ControllerBase
{
    private readonly IChatService _chatService;
    private readonly UserService _userService;
    private readonly ILogger<ChatsController> _logger;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    
    public ChatsController(
        IChatService chatService,
        UserService userService,
        ILogger<ChatsController> logger,
        IHubContext<ChatHub, IChatHubClient> hubContext)
    {
        _chatService = chatService;
        _userService = userService;
        _logger = logger;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Get all chats for the current user (sidebar metadata only)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ChatListItemDto>>> GetChats()
    {
        try
        {
            string userId = GetCurrentUserId();
            _logger.LogInformation("Retrieving chats for user: {UserId}", userId);
            
            var chats = await _chatService.GetChatsAsync(userId);
            
            // Map to DTOs
            var chatDtos = chats.Select(chat => new ChatListItemDto 
            {
                Id = chat.Id,
                Title = chat.Name,
                LastUpdated = chat.UpdatedAt,
                AssistantId = chat.Assistant?.Id
            }).ToList();
            
            return Ok(chatDtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving chats");
            return StatusCode(500, "An error occurred while retrieving chats");
        }
    }

    /// <summary>
    /// Get a specific chat by ID with messages
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ChatDto>> GetChat(string id)
    {
        try
        {
            string userId = GetCurrentUserId();
            var chat = await _chatService.GetChatByIdAsync(userId, id);
            
            if (chat == null)
            {
                return NotFound($"Chat with ID {id} not found");
            }

            // Map to DTO
            var chatDto = new ChatDto
            {
                Id = chat.Id,
                Title = chat.Name,
                CreatedAt = chat.CreatedAt,
                LastUpdated = chat.UpdatedAt,
                AssistantId = chat.Assistant?.Id,
                Messages = chat.Messages.Select(msg => msg.ToMessageDto()).ToList()
            };
            
            return Ok(chatDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving chat {ChatId}", id);
            return StatusCode(500, "An error occurred while retrieving the chat");
        }
    }

    /// <summary>
    /// Create a new chat with required messages
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ChatDto>> CreateChat(CreateChatDto createChatDto)
    {
        try
        {
            string userId = GetCurrentUserId();
            
            // Validate that at least one message exists
            if (createChatDto.Messages == null || !createChatDto.Messages.Any() ||
                createChatDto.Messages.Any(m => m.Chunks == null || !m.Chunks.Any() || 
                                            string.IsNullOrEmpty(m.Chunks.First().Content)))
            {
                return BadRequest("At least one valid message is required to create a chat");
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
            Type = Enum.Parse<AiMessageChunkType>(c.Type, true),
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
        // Take the first user message that was already added and start a streaming response
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
            var chatDto = chat.ToChatDto();
            
            return CreatedAtAction(nameof(GetChat), new { id = chat.Id }, chatDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating chat");
            return StatusCode(500, "An error occurred while creating the chat");
        }
    }

    /// <summary>
    /// Update a chat's title
    /// </summary>
    [HttpPut("{id}/title")]
    public async Task<ActionResult<ChatListItemDto>> UpdateChatTitle(string id, [FromBody] string newTitle)
    {
        try
        {
            string userId = GetCurrentUserId();
            var updatedChat = await _chatService.RenameChatAsync(userId, id, newTitle);
            
            if (updatedChat == null)
            {
                return NotFound($"Chat with ID {id} not found");
            }

            // Map to DTO
            var chatItemDto = new ChatListItemDto
            {
                Id = updatedChat.Id,
                Title = updatedChat.Name,
                LastUpdated = updatedChat.UpdatedAt,
                AssistantId = updatedChat.Assistant?.Id
            };
            
            return Ok(chatItemDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating chat title for chat {ChatId}", id);
            return StatusCode(500, "An error occurred while updating the chat title");
        }
    }

    /// <summary>
    /// Add a message to a chat (non-streaming)
    /// </summary>
    [HttpPost("messages")]
    public async Task<ActionResult<MessageDto>> AddMessage(CreateMessageDto createMessageDto)
    {
        try
        {
            string userId = GetCurrentUserId();
            
            // Convert chunks from DTO to model 
            var chunks = createMessageDto.Chunks.Select(c => new MessageChunk
            {
                Type = Enum.Parse<AiMessageChunkType>(c.Type, true),
                Content = c.Content
            }).ToList();
            
            // Create a message with the chunks
            var message = new AiChatMessage
            {
                Role = AiChatRole.User,
                Content = chunks,
                Filename = createMessageDto.Filename
            };
            
            var result = await _chatService.AddMessageAsync(userId, createMessageDto.ChatId, message);
            
            // Map to DTO using extension method
            var messageDto = message.ToMessageDto();
            
            return Ok(messageDto);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid request when adding message to chat {ChatId}", createMessageDto.ChatId);
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding message to chat {ChatId}", createMessageDto.ChatId);
            return StatusCode(500, "An error occurred while adding the message");
        }
    }
    
    /// <summary>
    /// Add a streaming message to a chat
    /// </summary>
    [HttpPost("messages/stream")]
    public async Task<ActionResult<MessageDto>> AddStreamingMessage(CreateMessageDto createMessageDto)
    {
        try
        {
            string userId = GetCurrentUserId();
            
            // Make sure we have content in our chunks
            if (createMessageDto.Chunks == null || !createMessageDto.Chunks.Any() || 
                string.IsNullOrEmpty(createMessageDto.Chunks.First().Content))
            {
                return BadRequest("Message content cannot be empty");
            }
            
            // Convert chunks from DTO to model
            var chunks = createMessageDto.Chunks.Select(c => new MessageChunk
            {
                Type = Enum.Parse<AiMessageChunkType>(c.Type, true),
                Content = c.Content
            }).ToList();
            
            // First prepare the message and get a placeholder
            // Create a message with the chunks
            var userMessage = new AiChatMessage
            {
                Id = Guid.NewGuid().ToString(),
                Role = AiChatRole.User,
                Content = chunks,
                Filename = createMessageDto.Filename,
                Timestamp = DateTime.UtcNow
            };
            
            // Add the user message to the chat
            await _chatService.AddMessageAsync(userId, createMessageDto.ChatId, userMessage);
            
            // Create empty assistant message placeholder
            var assistantMessage = new AiChatMessage
            {
                Id = Guid.NewGuid().ToString(),
                Role = AiChatRole.Assistant,
                Content = new List<MessageChunk>(),
                Timestamp = DateTime.UtcNow
            };
            
            // Map to DTO for the placeholder response using extension method
            var messageDto = assistantMessage.ToMessageDto();
            
            // Start streaming asynchronously (fire and forget)
            _ = Task.Run(async () => 
            {
                try 
                {
                    await _chatService.StartStreamingResponseAsync(userId, createMessageDto.ChatId, userMessage);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during streaming response for chat {ChatId}", createMessageDto.ChatId);
                }
            });
            
            return Ok(messageDto);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid request when adding streaming message to chat {ChatId}", createMessageDto.ChatId);
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting streaming message to chat {ChatId}", createMessageDto.ChatId);
            return StatusCode(500, "An error occurred while starting the streaming message");
        }
    }
    
    /// <summary>
    /// Delete a chat
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteChat(string id)
    {
        try
        {
            string userId = GetCurrentUserId();
            var success = await _chatService.DeleteChatAsync(userId, id);
            
            if (!success)
            {
                return NotFound($"Chat with ID {id} not found");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting chat {ChatId}", id);
            return StatusCode(500, "An error occurred while deleting the chat");
        }
    }
    
    /// <summary>
    /// Get a direct HTTP stream for a currently streaming message in a chat
    /// </summary>
    [HttpGet("{id}/stream")]
    public async Task<IActionResult> StreamChat(string id)
    {
        try
        {
            string userId = GetCurrentUserId();
            var chat = await _chatService.GetChatByIdAsync(userId, id);
            
            if (chat == null)
            {
                return NotFound($"Chat with ID {id} not found");
            }
            
            // Set up response headers for streaming
            Response.Headers.Add("Content-Type", "text/event-stream");
            Response.Headers.Add("Cache-Control", "no-cache");
            Response.Headers.Add("Connection", "keep-alive");
            
            // Check for any active streaming messages
            var activeMessage = _chatService.GetActiveStreamingMessage(userId, id);
            
            if (activeMessage == null)
            {
                // No active streaming, send 'done' event and complete
                await Response.WriteAsync("event: done\ndata: {}\n\n");
                await Response.Body.FlushAsync();
                return new EmptyResult();
            }
            
            // Send metadata to create an empty message container
            await Response.WriteAsync($"event: metadata\ndata: {{\n");
            await Response.WriteAsync($"  \"messageId\": \"{activeMessage.MessageId}\",\n");
            await Response.WriteAsync($"  \"isComplete\": {activeMessage.IsComplete.ToString().ToLower()}\n");
            await Response.WriteAsync("}\n\n");
            await Response.Body.FlushAsync();
            
            // Send each stored chunk individually exactly as they were sent originally
            // This ensures clients that join later get the exact same chunks in the same order
            foreach (var storedChunk in activeMessage.Chunks)
            {
                await Response.WriteAsync($"event: chunk\ndata: {{\n");
                await Response.WriteAsync($"  \"messageId\": \"{activeMessage.MessageId}\",\n");
                await Response.WriteAsync($"  \"chunkType\": \"text\",\n");  // We're storing the type in a future update
                await Response.WriteAsync($"  \"chunkIndex\": 0,\n");        // We'll update this when we support multiple chunks
                await Response.WriteAsync($"  \"content\": \"{storedChunk.Replace("\"", "\\\"")}\",\n");
                await Response.WriteAsync($"  \"isComplete\": false\n");    // Only the last one is complete
                await Response.WriteAsync("}\n\n");
                await Response.Body.FlushAsync();
                
                // Small delay to prevent overwhelming the client
                await Task.Delay(20);
            }
            
            // If message is complete, send one final event with isComplete=true
            if (activeMessage.IsComplete)
            {
                await Response.WriteAsync($"event: chunk\ndata: {{\n");
                await Response.WriteAsync($"  \"messageId\": \"{activeMessage.MessageId}\",\n");
                await Response.WriteAsync($"  \"chunkType\": \"text\",\n");
                await Response.WriteAsync($"  \"chunkIndex\": 0,\n");
                await Response.WriteAsync($"  \"content\": \"\",\n");
                await Response.WriteAsync($"  \"isComplete\": true\n");
                await Response.WriteAsync("}\n\n");
                await Response.Body.FlushAsync();
            }
            
            // If the message is already complete, we're done
            if (activeMessage.IsComplete)
            {
                await Response.WriteAsync("event: done\ndata: {}\n\n");
                await Response.Body.FlushAsync();
                return new EmptyResult();
            }
            
            // Create a cancellation token source with timeout
            using var cts = new CancellationTokenSource();
            cts.CancelAfter(TimeSpan.FromMinutes(10)); // Max streaming time of 10 minutes
            
            // Set up to monitor for streaming updates
            var lastContent = activeMessage.Content;
            var lastUpdated = activeMessage.LastUpdated;
            
            // Polling loop to check for updates
            while (!cts.Token.IsCancellationRequested)
            {
                // Wait a bit before checking for updates
                await Task.Delay(200, cts.Token);
                
                // Check for updates to the streaming message
                activeMessage = _chatService.GetActiveStreamingMessage(userId, id);
                
                // If it's gone, the generation is complete
                if (activeMessage == null)
                {
                    await Response.WriteAsync("event: done\ndata: {}\n\n");
                    await Response.Body.FlushAsync();
                    break;
                }
                
                // If there's new content, send just the new chunk
                if (activeMessage.LastUpdated > lastUpdated && activeMessage.Content.Length > lastContent.Length)
                {
                    var newContent = activeMessage.Content.Substring(lastContent.Length);
                    
                    await Response.WriteAsync($"event: chunk\ndata: {{\n");
                    await Response.WriteAsync($"  \"messageId\": \"{activeMessage.MessageId}\",\n");
                    await Response.WriteAsync($"  \"content\": \"{newContent.Replace("\"", "\\\"")}\",\n");
                    await Response.WriteAsync($"  \"isComplete\": {activeMessage.IsComplete.ToString().ToLower()}\n");
                    await Response.WriteAsync("}\n\n");
                    await Response.Body.FlushAsync();
                    
                    lastContent = activeMessage.Content;
                    lastUpdated = activeMessage.LastUpdated;
                }
                
                // If the message is complete, send a done event
                if (activeMessage.IsComplete)
                {
                    await Response.WriteAsync("event: done\ndata: {}\n\n");
                    await Response.Body.FlushAsync();
                    break;
                }
            }
            
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming chat {ChatId}", id);
            return StatusCode(500, "An error occurred while streaming the chat");
        }
    }
    
    /// <summary>
    /// Get the current user ID
    /// </summary>
    private string GetCurrentUserId()
    {
        if (User?.Identity?.IsAuthenticated == true)
        {
            return _userService.GetCurrentUserId(User);
        }
        throw new UnauthorizedAccessException("User must be authenticated to access this resource");
    }
}
