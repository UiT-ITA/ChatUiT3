using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;

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
            
            var chats = await _chatService.GetChatsForUserAsync(userId);
            
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
                Messages = chat.Messages.Select(msg => new MessageDto
                {
                    Id = msg.Id,
                    Text = msg.Content,
                    Sender = msg.Role.ToString().ToLower(),
                    Timestamp = msg.Timestamp
                }).ToList()
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
    /// Create a new chat
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ChatDto>> CreateChat(CreateChatDto createChatDto)
    {
        try
        {
            string userId = GetCurrentUserId();
            var chat = await _chatService.CreateChatAsync(userId, createChatDto.Title, createChatDto.AssistantId);
            
            // Map to DTO
            var chatDto = new ChatDto
            {
                Id = chat.Id,
                Title = chat.Name,
                CreatedAt = chat.CreatedAt,
                LastUpdated = chat.UpdatedAt,
                AssistantId = chat.Assistant?.Id,
                Messages = chat.Messages.Select(msg => new MessageDto
                {
                    Id = msg.Id,
                    Text = msg.Content,
                    Sender = msg.Role.ToString().ToLower(),
                    Timestamp = msg.Timestamp
                }).ToList()
            };
            
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
            var updatedChat = await _chatService.UpdateChatTitleAsync(userId, id, newTitle);
            
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
            var message = await _chatService.AddMessageAsync(userId, createMessageDto.ChatId, createMessageDto.Text);
            
            // Map to DTO
            var messageDto = new MessageDto
            {
                Id = message.Id,
                Text = message.Content,
                Sender = message.Role.ToString().ToLower(),
                Timestamp = message.Timestamp
            };
            
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
            
            // First prepare the message and get a placeholder
            var (_, assistantMessage) = await _chatService.PrepareUserMessageAsync(
                userId, 
                createMessageDto.ChatId, 
                createMessageDto.Text
            );
            
            if (assistantMessage == null)
            {
                return NotFound($"Chat with ID {createMessageDto.ChatId} not found");
            }
            
            // Map to DTO for the placeholder response
            var messageDto = new MessageDto
            {
                Id = assistantMessage.Id,
                Text = assistantMessage.Content,
                Sender = "assistant",
                Timestamp = assistantMessage.Timestamp
            };
            
            // Start streaming asynchronously (fire and forget)
            _ = Task.Run(async () => 
            {
                try 
                {
                    await _chatService.StreamResponseAsync(userId, createMessageDto.ChatId, assistantMessage.Id);
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
    /// Get the current user ID
    /// </summary>
    private string GetCurrentUserId()
    {
        if (User?.Identity?.IsAuthenticated == true)
        {
            return _userService.GetCurrentUserId(User);
        }
        return "anonymous";
    }
}
