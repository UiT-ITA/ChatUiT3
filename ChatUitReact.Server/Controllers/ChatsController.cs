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


   
}
