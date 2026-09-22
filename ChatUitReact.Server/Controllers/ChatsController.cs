using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Extentions;
using ChatUitReact.Server.Services.Tools;

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
    private readonly IUserTokenProviderFactory _tokenProviders;

    public ChatsController(
        IChatService chatService,
        UserService userService,
        ILogger<ChatsController> logger,
        IHubContext<ChatHub, IChatHubClient> hubContext,
        IAssistantService assistantService,
        IModelService modelService,
        IUserTokenProviderFactory tokenProviders)
    {
        _tokenProviders = tokenProviders;
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

    /// <summary>
    /// What the background generation needs from this request for tools: the caller's roles and
    /// groups, a token provider bound to their assertion, and the client tools they declared.
    /// </summary>
    private ToolSessionInput BuildToolSession(List<ClientToolDeclarationDto>? clientTools) => new()
    {
        Access = _userService.GetUserAccess(User),
        Tokens = _tokenProviders.Create(User, IncomingBearerToken()),
        ClientTools = clientTools ?? []
    };

    /// <summary>The raw token this request was authenticated with; it is the On-Behalf-Of assertion.</summary>
    private string? IncomingBearerToken()
    {
        var header = Request.Headers.Authorization.ToString();
        const string prefix = "Bearer ";
        return header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ? header[prefix.Length..].Trim() : null;
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
            
            var promptUser = await _assistantService.GetPromptUserContextAsync(_userService.GetUserIdentity(User));
            var clientTools = request.Messages.LastOrDefault()?.ClientTools;
            var chat = await _chatService.CreateChatAsync(userId, request.AssistantId, initialMessages, promptUser, BuildToolSession(clientTools));
            
            await _hubContext.Clients.Group(userId).ChatListUpdated();
            
            return CreatedAtAction(nameof(GetChat), new { chatId = chat.Id }, MapToDto(chat));
        }
        catch (ToolArgumentException ex)
        {
            return BadRequest(new { error = "invalid_client_tools", message = ex.Message });
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

            var promptUser = await _assistantService.GetPromptUserContextAsync(_userService.GetUserIdentity(User));

            if (chatId == "new")
            {
                var messages = new List<ChatMessage> { message };
                var chat = await _chatService.CreateChatAsync(userId, request.AssistantId, messages, promptUser, BuildToolSession(request.ClientTools));
                
                await _hubContext.Clients.Group(userId).ChatListUpdated();
                
                return Ok(new { chatId = chat.Id });
            }
            else
            {
                // Uses the same streaming path as the SignalR hub, so both entry points behave alike.
                await _chatService.SendStreamingMessageAsync(userId, chatId, message, request.AssistantId, promptUser, BuildToolSession(request.ClientTools));
                
                await _hubContext.Clients.Group(userId).ChatUpdated(chatId);
                
                return Ok(new { success = true });
            }
        }
        catch (ToolArgumentException ex)
        {
            return BadRequest(new { error = "invalid_client_tools", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message to chat {ChatId}", chatId);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("{chatId}/messages/{messageId}/cancel")]
    public async Task<ActionResult<object>> CancelMessage(string chatId, string messageId)
    {
        try
        {
            var userId = GetCurrentUserId();

            // False means the generation already finished (or was never this user's): the client
            // leaves the completed message alone instead of restoring the composer.
            var cancelled = await _chatService.CancelGenerationAsync(userId, chatId, messageId);

            return Ok(new { cancelled });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling message {MessageId} in chat {ChatId}", messageId, chatId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Answers a tool call that paused the run: approve or reject a confirmation, retry or
    /// decline after granting consent, or deliver a client tool's result. 409 when nothing is
    /// waiting under that id any more (another tab answered, or it timed out).
    /// </summary>
    [HttpPost("{chatId}/messages/{messageId}/tool-calls/{toolCallId}/respond")]
    public async Task<ActionResult<ToolCallResponseResultDto>> RespondToToolCall(
        string chatId, string messageId, string toolCallId, [FromBody] ToolCallResponseDto response)
    {
        try
        {
            var userId = GetCurrentUserId();
            var result = await _chatService.RespondToToolCallAsync(userId, chatId, messageId, toolCallId, response, User, IncomingBearerToken());

            return result.Accepted ? Ok(result) : Conflict(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = "invalid_response", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error responding to tool call {ToolCallId} on message {MessageId}", toolCallId, messageId);
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
            Files = MapFilesToDto(message.Files),
            AssistantId = message.AssistantId,
            AssistantName = message.AssistantName,
            Activity = message.Activity,
            TokenCounts = message.TokenCounts,
            FileTokenCounts = message.FileTokenCounts
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
