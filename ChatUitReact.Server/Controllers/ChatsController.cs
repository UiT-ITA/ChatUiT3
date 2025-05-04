using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatsController : ControllerBase
{
    private readonly DatabaseService _databaseService;
    private readonly UserService _userService;
    private readonly ChatNotificationService _notificationService;

    public ChatsController(
        DatabaseService mockDbService, 
        UserService userService,
        ChatNotificationService notificationService)
    {
        _databaseService = mockDbService;
        _userService = userService;
        _notificationService = notificationService;
    }

    // GET api/chats
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AiChatSummaryDto>>> GetChats()
    {
        var userId = _userService.GetCurrentUserId(User);
        var chats = _databaseService.GetChatSummaries(userId);
        
        // Notify all connected clients (helps sync across devices)
        await _notificationService.NotifyChatsListUpdated(userId, chats);
        
        return Ok(chats);
    }

    // GET api/chats/{id}
    [HttpGet("{id}")]
    public ActionResult<AiChatDto> GetChat(string id)
    {
        var userId = _userService.GetCurrentUserId(User);
        var chat = _databaseService.GetChat(id, userId);
        
        if (chat == null)
            return NotFound();
            
        return Ok(chat);
    }

    // POST api/chats
    [HttpPost]
    public async Task<ActionResult<AiChatDto>> CreateChat(AiChatCreateDto createDto)
    {
        var userId = _userService.GetCurrentUserId(User);
        var chat = _databaseService.CreateChat(userId, createDto);
        
        // Notify about the newly created chat
        var chatSummary = new AiChatSummaryDto
        {
            Id = chat.Id,
            Name = chat.Name,
            AssistantName = chat.Assistant.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt
        };
        await _notificationService.NotifyChatCreated(userId, chatSummary);
        
        return CreatedAtAction(nameof(GetChat), new { id = chat.Id }, chat);
    }

    // DELETE api/chats/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteChat(string id)
    {
        var userId = _userService.GetCurrentUserId(User);
        var success = _databaseService.DeleteChat(id, userId);
        
        if (!success)
            return NotFound();

        // Notify about the deleted chat
        await _notificationService.NotifyChatDeleted(userId, id);
            
        return NoContent();
    }
}

