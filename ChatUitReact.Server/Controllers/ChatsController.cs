using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize("DefaultAuth")]
public class ChatsController : ControllerBase
{
    private readonly DummyService _dummyService;
    private readonly UserService _userService;

    public ChatsController(DummyService dummyService, UserService userService)
    {
        _dummyService = dummyService;
        _userService = userService;
    }

    // GET api/chats
    [HttpGet]
    public ActionResult<IEnumerable<AiChatSummaryDto>> GetChats()
    {
        var userId = _userService.GetCurrentUserId(User);
        var chats = _dummyService.GetChatSummaries(userId);
        return Ok(chats);
    }

    // GET api/chats/{id}
    [HttpGet("{id}")]
    public ActionResult<AiChatDto> GetChat(string id)
    {
        var userId = _userService.GetCurrentUserId(User);
        var chat = _dummyService.GetChat(id, userId);
        
        if (chat == null)
            return NotFound();
            
        return Ok(chat);
    }

    // POST api/chats
    [HttpPost]
    public ActionResult<AiChatDto> CreateChat(AiChatCreateDto createDto)
    {
        var userId = _userService.GetCurrentUserId(User);
        var chat = _dummyService.CreateChat(userId, createDto);
        return CreatedAtAction(nameof(GetChat), new { id = chat.Id }, chat);
    }

    // DELETE api/chats/{id}
    [HttpDelete("{id}")]
    public IActionResult DeleteChat(string id)
    {
        var userId = _userService.GetCurrentUserId(User);
        
        // This would need to be implemented in DummyService
        // var success = _dummyService.DeleteChat(id, userId);
        
        // if (!success)
        //     return NotFound();
            
        return NoContent();
    }
}
