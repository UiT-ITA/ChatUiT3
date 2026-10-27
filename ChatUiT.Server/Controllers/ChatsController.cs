using ChatUiT.Server.Authentication;
using ChatUiT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ChatUiT.Server.Hubs;
using ChatUiT.Server.Models;
using ChatUiT.Server.Extentions;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Controllers;

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

    /// <summary>
    /// Null when the assistant may hold red data in a chat of this user, otherwise the response
    /// refusing it: forbidden when it is not in the user's list, bad request when it is not red.
    /// </summary>
    private async Task<ActionResult?> RefuseRedAssistantAsync(string userId, string? assistantId)
    {
        var assistant = string.IsNullOrWhiteSpace(assistantId) ? null : await _assistantService.GetAssistantByIdAsync(assistantId);
        if (assistant == null || !await _assistantService.IsInUserListAsync(assistant, userId, _userService.GetUserAccess(User)))
        {
            return Forbid();
        }

        return _assistantService.ClassificationOf(assistant) == DataClassification.Red
            ? null
            : BadRequest("Red data requires a red assistant");
    }

    private string GetCurrentUserId()
    {
        return _userService.GetCurrentUserId(User);
    }

    /// <summary>
    /// What the background generation needs from this request for tools: the caller's roles and
    /// groups, a token provider bound to their assertion, the client tools they declared, and
    /// their time zone.
    /// </summary>
    private ToolSessionInput BuildToolSession(List<ClientToolDeclarationDto>? clientTools, string? timeZone)
    {
        var identity = _userService.GetUserIdentity(User);
        return new ToolSessionInput
        {
            Access = _userService.GetUserAccess(User),
            Tokens = _tokenProviders.Create(User, Request.BearerToken()),
            ClientTools = clientTools ?? [],
            UserDisplayName = identity.DisplayName,
            UserPrincipalName = identity.Username,
            TimeZone = timeZone
        };
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

            if (request.RedEnabled && await RefuseRedAssistantAsync(userId, request.AssistantId) is { } refused)
            {
                return refused;
            }

            var chat = await _chatService.CreateChatAsync(userId, request.AssistantId, request.RedEnabled);

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

            var promptUser = await _assistantService.GetPromptUserContextAsync(_userService.GetUserIdentity(User));

            // Uses the same streaming path as the SignalR hub, so both entry points behave alike.
            await _chatService.SendStreamingMessageAsync(userId, chatId, message, request.AssistantId, promptUser, BuildToolSession(request.ClientTools, request.TimeZone));

            await _hubContext.Clients.Group(userId).ChatUpdated(chatId);

            return Ok(new { success = true });
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
    /// Answers a tool call that paused the run: approve or reject a confirmation, or deliver a
    /// client tool's result. 409 when nothing is
    /// waiting under that id any more (another tab answered, or it timed out).
    /// </summary>
    [HttpPost("{chatId}/messages/{messageId}/tool-calls/{toolCallId}/respond")]
    public async Task<ActionResult<ToolCallResponseResultDto>> RespondToToolCall(
        string chatId, string messageId, string toolCallId, [FromBody] ToolCallResponseDto response)
    {
        try
        {
            var userId = GetCurrentUserId();
            var result = await _chatService.RespondToToolCallAsync(userId, chatId, messageId, toolCallId, response);

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
            RedEnabled = chat.RedEnabled,
            AssistantId = chat.AssistantId,
            LoadedFiles = MapLoadedFiles(chat.LoadedFiles)
        };
    }

    private static List<ChatLoadedFileDto> MapLoadedFiles(List<ChatLoadedFile> files)
        => files.Select(f => new ChatLoadedFileDto
        {
            FileId = f.FileId,
            SourceFilename = f.SourceFilename,
            TokenCounts = new Dictionary<string, int>(f.TokenCounts)
        }).ToList();

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
            RedEnabled = chat.RedEnabled,
            AssistantId = chat.AssistantId,
            LoadedFiles = MapLoadedFiles(chat.LoadedFiles),
            // System messages (the knowledge sources read at the start of the chat) are for the model only.
            Messages = chat.Messages.Where(m => m.Role != AiChatRole.System).Select(MapMessageToDto).ToList()
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

            var enableRed = false;
            if (request.RedEnabled.HasValue)
            {
                var chat = await _chatService.GetChatHeaderAsync(userId, chatId);
                if (chat == null)
                {
                    return NotFound();
                }

                if (!request.RedEnabled.Value && chat.RedEnabled)
                {
                    return BadRequest("Red data cannot be switched off once allowed");
                }

                if (request.RedEnabled.Value && !chat.RedEnabled)
                {
                    var assistantId = string.IsNullOrWhiteSpace(request.AssistantId) ? chat.AssistantId : request.AssistantId;
                    if (!await CanUseAssistantAsync(assistantId))
                    {
                        return Forbid();
                    }
                    if (await RefuseRedAssistantAsync(userId, assistantId) is { } refused)
                    {
                        return refused;
                    }
                    enableRed = true;
                }
            }

            if (newName != null)
            {
                await _chatService.UpdateChatAsync(userId, chatId, newName);
            }

            if (enableRed)
            {
                await _chatService.EnableRedAsync(userId, chatId, request.AssistantId);
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
