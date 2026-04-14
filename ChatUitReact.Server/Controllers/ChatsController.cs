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

    private string GetCurrentUserId()
    {
        return _userService.GetCurrentUserId(User);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ChatHeaderDto>>> GetChats()
    {
        try
        {
            var userId = GetCurrentUserId();
            var chats = await _chatService.GetChatsAsync(userId);
            var chatDtos = chats.Select(MapToHeaderDto);
            return Ok(chatDtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chats");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("{chatId}")]
    public async Task<ActionResult<ChatDto>> GetChat(string chatId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var chat = await _chatService.GetChatByIdAsync(userId, chatId);
            
            if (chat == null)
            {
                return NotFound("Chat not found");
            }

            return Ok(MapToDto(chat));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat {ChatId}", chatId);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("{chatId}/messages")]
    public async Task<ActionResult<object>> GetMessages(string chatId, [FromQuery] int page = 1, [FromQuery] int size = 50)
    {
        try
        {
            var userId = GetCurrentUserId();
            var chat = await _chatService.GetChatByIdAsync(userId, chatId);
            
            if (chat == null)
            {
                return NotFound("Chat not found");
            }

            // Simple pagination - in a real app, you'd want more efficient DB queries
            var allMessages = chat.Messages.OrderBy(m => m.Timestamp).ToList();
            var totalMessages = allMessages.Count;
            var skip = (page - 1) * size;
            var messages = allMessages.Skip(skip).Take(size).Select(MapMessageToDto).ToList();
            var hasMore = skip + size < totalMessages;

            return Ok(new { messages, hasMore });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting messages for chat {ChatId}", chatId);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost]
    public async Task<ActionResult<ChatDto>> CreateChat([FromBody] CreateChatDto request)
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // Map DTO messages to domain messages
            var initialMessages = new List<ChatMessage>();
            foreach (var msgDto in request.Messages)
            {
                var message = new ChatMessage
                {
                    Role = AiChatRole.User,
                    Content = msgDto.Content,
                    Status = AiChatStatus.Success,
                    Files = msgDto.Files != null ? MapDtoToFiles(msgDto.Files) : new List<ChatFile>()
                };
                initialMessages.Add(message);
            }
            
            var chat = await _chatService.CreateChatAsync(userId, request.AssistantId, initialMessages);
            
            // Notify all clients that chat list has changed
            await _hubContext.Clients.Group(userId).ChatListUpdated();
            
            return CreatedAtAction(nameof(GetChat), new { chatId = chat.Id }, MapToDto(chat));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating chat");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("{chatId}/messages")]
    public async Task<ActionResult<object>> SendMessage(string chatId, [FromBody] SendMessageDto request)
    {
        try
        {
            var userId = GetCurrentUserId();
            
            var message = new ChatMessage
            {
                Role = AiChatRole.User,
                Content = request.Content,
                Status = AiChatStatus.Success,
                Files = request.Files != null ? MapDtoToFiles(request.Files) : new List<ChatFile>()
            };

            if (chatId == "new")
            {
                // Create new chat with the message
                var messages = new List<ChatMessage> { message };
                var chat = await _chatService.CreateChatAsync(userId, request.AssistantId, messages);
                
                // Notify that chat list has changed (new chat created)
                await _hubContext.Clients.Group(userId).ChatListUpdated();
                
                return Ok(new { chatId = chat.Id });
            }
            else
            {
                // Send message to existing chat using the same streaming logic as SignalR
                await _chatService.SendStreamingMessageAsync(userId, chatId, message, request.AssistantId);
                
                // Notify that this specific chat has been updated
                await _hubContext.Clients.Group(userId).ChatUpdated(chatId);
                
                return Ok(new { success = true });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message to chat {ChatId}", chatId);
            return StatusCode(500, "Internal server error");
        }
    }

    private List<ChatFile> MapDtoToFiles(IEnumerable<CreateChatFileDto> fileDtos)
    {
        var result = new List<ChatFile>();
        foreach (var fileDto in fileDtos)
        {
            var chatFile = new ChatFile
            {
                SourceFilename = fileDto.SourceFilename,
                Chunks = new List<ChatFileChunk>()
            };

            foreach (var chunkDto in fileDto.Chunks)
            {
                chatFile.Chunks.Add(new ChatFileChunk
                {
                    Type = chunkDto.Type,
                    Text = chunkDto.Text,
                    Format = chunkDto.Format,
                    Base64 = chunkDto.Base64
                });
            }

            result.Add(chatFile);
        }
        return result;
    }

    private List<ChatFile> MapDtoToFiles(IEnumerable<ChatFileDto> fileDtos)
    {
        var result = new List<ChatFile>();
        foreach (var fileDto in fileDtos)
        {
            var chatFile = new ChatFile
            {
                Id = string.IsNullOrEmpty(fileDto.Id) ? Guid.NewGuid().ToString() : fileDto.Id,
                SourceFilename = fileDto.SourceFilename,
                Chunks = new List<ChatFileChunk>()
            };

            foreach (var chunkDto in fileDto.Chunks)
            {
                chatFile.Chunks.Add(new ChatFileChunk
                {
                    Type = chunkDto.Type,
                    Text = chunkDto.Text,
                    Format = chunkDto.Format,
                    Base64 = chunkDto.Base64
                });
            }

            result.Add(chatFile);
        }
        return result;
    }

    private ChatHeaderDto MapToHeaderDto(Chat chat)
    {
        return new ChatHeaderDto
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status,
            AssistantId = chat.AssistantId
        };
    }

    private ChatDto MapToDto(Chat chat)
    {
        return new ChatDto
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status,
            AssistantId = chat.AssistantId,
            Messages = chat.Messages.Select(MapMessageToDto).ToList()
        };
    }

    private ChatMessageDto MapMessageToDto(ChatMessage message)
    {
        return new ChatMessageDto
        {
            Id = message.Id,
            Role = message.Role,
            Timestamp = message.Timestamp,
            Content = message.Content,
            Status = message.Status,
            Files = MapFilesToDto(message.Files)
        };
    }

    private List<ChatFileDto> MapFilesToDto(List<ChatFile> files)
    {
        return files.Select(f => new ChatFileDto
        {
            Id = f.Id,
            SourceFilename = f.SourceFilename,
            Chunks = f.Chunks.Select(c => new ChatFileChunkDto
            {
                Type = c.Type,
                Text = c.Text,
                Format = c.Format,
                Base64 = c.Base64
            }).ToList()
        }).ToList();
    }

    [HttpDelete("{chatId}")]
    public async Task<ActionResult> DeleteChat(string chatId)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _chatService.DeleteChatAsync(userId, chatId);
            
            // Notify that chat list has changed (chat deleted)
            await _hubContext.Clients.Group(userId).ChatListUpdated();
            
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting chat {ChatId}", chatId);
            return StatusCode(500, "Internal server error");
        }
    }
}
