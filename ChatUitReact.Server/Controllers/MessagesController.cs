using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/chats/{chatId}/messages")]
[Authorize("DefaultAuth")]
public class MessagesController : ControllerBase
{
    private readonly DummyService _dummyService;
    private readonly UserService _userService;

    public MessagesController(DummyService dummyService, UserService userService)
    {
        _dummyService = dummyService;
        _userService = userService;
    }

    // GET api/chats/{chatId}/messages
    [HttpGet]
    public ActionResult<IEnumerable<AiChatMessageDto>> GetMessages(string chatId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
    {
        var userId = _userService.GetCurrentUserId(User);
        var messages = _dummyService.GetChatMessages(chatId, userId, skip, take);
        return Ok(messages);
    }

    // POST api/chats/{chatId}/messages
    [HttpPost]
    public ActionResult<AiChatMessageDto> AddMessage(string chatId, AiChatMessageCreateDto messageDto)
    {
        var userId = _userService.GetCurrentUserId(User);
        
        // Set chat ID from route
        messageDto.ChatId = chatId;
        
        var message = _dummyService.AddChatMessage(userId, messageDto);
        
        if (message == null)
            return NotFound();
            
        return Ok(message);
    }
}
