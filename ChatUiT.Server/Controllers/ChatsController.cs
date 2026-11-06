using ChatUiT.Server.Authentication;
using ChatUiT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ChatUiT.Server.Hubs;
using ChatUiT.Server.Models;
using ChatUiT.Server.Extentions;
using ChatUiT.Server.Services.Tools;
using ChatUiT.Server.Telemetry;

namespace ChatUiT.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatsController : ControllerBase
{
    private const int MaxChatNameLength = 200;

    private readonly IChatService _chatService;
    private readonly UserService _userService;
    private readonly AppTelemetry _telemetry;
    private readonly IDatabaseService _databaseService;
    private readonly IHubContext<AppHub, IAppHubClient> _hubContext;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;
    private readonly IUserTokenProviderFactory _tokenProviders;

    public ChatsController(
        IChatService chatService,
        UserService userService,
        AppTelemetry telemetry,
        IDatabaseService databaseService,
        IHubContext<AppHub, IAppHubClient> hubContext,
        IAssistantService assistantService,
        IModelService modelService,
        IUserTokenProviderFactory tokenProviders)
    {
        _tokenProviders = tokenProviders;
        _chatService = chatService;
        _userService = userService;
        _telemetry = telemetry;
        _databaseService = databaseService;
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

        return await _modelService.GetModelForUserAsync<LanguageModel>(modelId, _userService.GetUserRoles(User)) != null;
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
        var userId = GetCurrentUserId();
        var chats = await _chatService.GetChatListAsync(userId);
        var chatDtos = chats.Select(MapToHeaderDto);
        return Ok(chatDtos);
    }

    [HttpGet("{chatId}")]
    public async Task<ActionResult<ChatDto>> GetChat(string chatId)
    {
        var userId = GetCurrentUserId();
        var chat = await _chatService.GetChatByIdAsync(userId, chatId, includeFileContent: false);

        if (chat == null)
        {
            return NotFound("Chat not found");
        }

        return Ok(MapToDto(chat));
    }

    [HttpGet("{chatId}/files/{fileId}")]
    public async Task<ActionResult<ChatFileDto>> GetChatFile(string chatId, string fileId)
    {
        var userId = GetCurrentUserId();
        var file = await _chatService.GetChatFileAsync(userId, chatId, fileId);

        if (file == null)
        {
            return NotFound("File not found");
        }

        return Ok(MapFilesToDto(new List<ChatFile> { file }).First());
    }

    [HttpPost]
    public async Task<ActionResult<ChatDto>> CreateChat([FromBody] CreateChatDto request)
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
        _telemetry.ChatCreated(chat.Id, request.AssistantId);
        if (request.RedEnabled)
        {
            _telemetry.ChatRedEnabled(chat.Id, request.AssistantId);
        }

        await _hubContext.Clients.Group(userId).ChatListUpdated();

        return CreatedAtAction(nameof(GetChat), new { chatId = chat.Id }, MapToDto(chat));
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
            await _chatService.SendStreamingMessageAsync(userId, chatId, message, request.AssistantId, promptUser, BuildToolSession(request.ClientTools, request.TimeZone), request.Answers);

            await _hubContext.Clients.Group(userId).ChatUpdated(chatId);

            return Ok(new { success = true });
        }
        catch (ToolArgumentException ex)
        {
            return BadRequest(new { error = "invalid_client_tools", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = "invalid_response", message = ex.Message });
        }
    }

    [HttpPost("{chatId}/messages/{messageId}/cancel")]
    public async Task<ActionResult<object>> CancelMessage(string chatId, string messageId)
    {
        var userId = GetCurrentUserId();

        // False means the generation already finished (or was never this user's): the client
        // leaves the completed message alone instead of restoring the composer.
        var (cancelled, undone) = await _chatService.CancelGenerationAsync(userId, chatId, messageId);

        return Ok(new { cancelled, undone });
    }

    /// <summary>
    /// Answers a tool call a message waits on: approve or reject a confirmation, answer a
    /// question, or deliver a client tool's result. The last answer the message waits for
    /// continues it on a new stream. 409 when nothing waits under that id any more (another tab
    /// answered, or a new message left it unanswered).
    /// </summary>
    [HttpPost("{chatId}/messages/{messageId}/tool-calls/{toolCallId}/respond")]
    public async Task<ActionResult<ToolCallResponseResultDto>> RespondToToolCall(
        string chatId, string messageId, string toolCallId, [FromBody] RespondToToolCallDto response)
    {
        try
        {
            var userId = GetCurrentUserId();
            var promptUser = await _assistantService.GetPromptUserContextAsync(_userService.GetUserIdentity(User));
            var result = await _chatService.RespondToToolCallAsync(
                userId, chatId, messageId, toolCallId, response, promptUser, BuildToolSession(response.ClientTools, response.TimeZone));

            return result.Accepted ? Ok(result) : Conflict(result);
        }
        catch (ToolArgumentException ex)
        {
            return BadRequest(new { error = "invalid_client_tools", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = "invalid_response", message = ex.Message });
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
            _telemetry.ChatRedEnabled(chatId, request.AssistantId);
        }

        if (request.IsFavorite.HasValue)
        {
            await _chatService.SetChatFavoriteAsync(userId, chatId, request.IsFavorite.Value);
        }

        var newAssistantId = enableRed && !string.IsNullOrWhiteSpace(request.AssistantId) ? request.AssistantId : null;
        if (newName != null || request.IsFavorite.HasValue || newAssistantId != null)
        {
            _telemetry.ChatUpdated(chatId, newName, request.IsFavorite, newAssistantId);
        }

        return NoContent();
    }

    [HttpDelete("{chatId}")]
    public async Task<ActionResult> DeleteChat(string chatId)
    {
        var userId = GetCurrentUserId();
        var existing = await _databaseService.GetChatByIdAsync(userId, chatId, includeFileContent: false);
        await _chatService.DeleteChatAsync(userId, chatId);
        _telemetry.ChatDeleted(
            chatId,
            existing?.Name,
            existing?.Messages.Count(m => m.Role != AiChatRole.System),
            existing == null ? null : (int)(DateTime.UtcNow - existing.CreatedAt).TotalDays);
        
        await _hubContext.Clients.Group(userId).ChatListUpdated();
        
        return NoContent();
    }
}
