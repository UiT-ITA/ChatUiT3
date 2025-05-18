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


    [HttpGet]
    public async Task<ActionResult<IEnumerable<AiChatHeader>>> GetChats()
    {
        try
        {
            string userId = GetCurrentUserId();
            _logger.LogInformation("Retrieving chats for user: {UserId}", userId);
            
            var chats = await _chatService.GetChatListAsync(userId);
            
            
            return Ok(chats);
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
    public async Task<ActionResult<AiChat>> GetChat(string id)
    {
        try
        {
            string userId = GetCurrentUserId();
            var chat = await _chatService.GetChatByIdAsync(userId, id);
            
            if (chat == null)
            {
                return NotFound($"Chat with ID {id} not found");
            }
            
            return Ok(chat);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving chat {ChatId}", id);
            return StatusCode(500, "An error occurred while retrieving the chat");
        }
    }

  
    private string GetCurrentUserId()
    {
        if (User?.Identity?.IsAuthenticated == true)
        {
            return _userService.GetCurrentUserId(User);
        }
        throw new UnauthorizedAccessException("User must be authenticated to access this resource");
    }
}
