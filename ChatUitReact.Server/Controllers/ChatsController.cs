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
    private const int MaxChatNameLength = 200;

    private readonly IChatService _chatService;
    private readonly UserService _userService;
    private readonly ILogger<ChatsController> _logger;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;

    public ChatsController(
        IChatService chatService,
        UserService userService,
        ILogger<ChatsController> logger,
        IHubContext<ChatHub, IChatHubClient> hubContext,
        IAssistantService assistantService,
        IModelService modelService)
    {
        _chatService = chatService;
        _userService = userService;
        _logger = logger;
        _hubContext = hubContext;
        _assistantService = assistantService;
        _modelService = modelService;
    }

    /// <summary>
    /// Whether the caller may use the model behind an assistant. Filtering the model picker
    /// is not enough on its own — an assistant id can be posted directly.
    /// </summary>
    private async Task<bool> CanUseAssistantAsync(string? assistantId)
    {
        if (string.IsNullOrWhiteSpace(assistantId))
        {
            return true; // Missing assistant is handled downstream with its own error.
        }

        var assistant = await _assistantService.GetAssistantByIdAsync(assistantId);
        var modelId = assistant?.ChatSettings?.Model?.Id;

        if (string.IsNullOrWhiteSpace(modelId))
        {
            return true;
        }

        return await _modelService.GetModelForUserAsync(modelId, _userService.GetUserRoles(User)) != null;
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
            var chats = await _chatService.GetChatListAsync(userId);
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
            var chat = await _chatService.GetChatByIdAsync(userId, chatId, includeFileContent: false);

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

    [HttpGet("{chatId}/files/{fileId}")]
    public async Task<ActionResult<ChatFileDto>> GetChatFile(string chatId, string fileId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var file = await _chatService.GetChatFileAsync(userId, chatId, fileId);

            if (file == null)
            {
                return NotFound("File not found");
            }

            return Ok(MapFilesToDto(new List<ChatFile> { file }).First());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file {FileId} for chat {ChatId}", fileId, chatId);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost]
    public async Task<ActionResult<ChatDto>> CreateChat([FromBody] CreateChatDto request)
    {
        try
        {
            var userId = GetCurrentUserId();

            if (!await CanUseAssistantAsync(request.AssistantId))
            {
                return Forbid();
            }

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

            if (!await CanUseAssistantAsync(request.AssistantId))
            {
                return Forbid();
            }

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

    private ChatHeaderDto MapToHeaderDto(ChatHeader chat)
    {
        return new ChatHeaderDto
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status,
            IsFavorite = chat.IsFavorite,
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
            IsFavorite = chat.IsFavorite,
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

    [HttpPatch("{chatId}")]
    public async Task<ActionResult> UpdateChat(string chatId, [FromBody] UpdateChatDto request)
    {
        try
        {
            var userId = GetCurrentUserId();

            string? newName = null;
            if (request.Name != null)
            {
                newName = request.Name.Trim();
                if (newName.Length == 0)
                {
                    return BadRequest("Chat name cannot be empty");
                }
                if (newName.Length > MaxChatNameLength)
                {
                    return BadRequest($"Chat name cannot be longer than {MaxChatNameLength} characters");
                }
            }

            if (newName != null)
            {
                await _chatService.UpdateChatAsync(userId, chatId, newName);
            }

            if (request.IsFavorite.HasValue)
            {
                await _chatService.SetChatFavoriteAsync(userId, chatId, request.IsFavorite.Value);
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating chat {ChatId}", chatId);
            return StatusCode(500, "Internal server error");
        }
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
