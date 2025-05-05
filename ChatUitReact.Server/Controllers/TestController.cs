using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TestController : ControllerBase
{
    private readonly ILogger<TestController> _logger;
    private readonly IHubContext<TestHub, ITestClient> _hubContext;
    private readonly IHubContext<TestAuthHub, ITestClient> _hubContextAuth;

    public TestController(ILogger<TestController> logger, IHubContext<TestHub, ITestClient> hubContext, IHubContext<TestAuthHub, ITestClient> hubContextAuth)
    {
        _logger = logger;
        _hubContext = hubContext;
        _hubContextAuth = hubContextAuth;
    }

    // Send message to all clients in testhub
    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] string message)
    {
        await _hubContext.Clients.All.ReceiveMessage(message);
        return Ok("Message sent to all clients.");
    }

    [HttpPost("testAuth")]
    public async Task<IActionResult> TestAuth([FromBody] string message)
    {
        await _hubContextAuth.Clients.All.ReceiveMessage(message);
        return Ok("Message sent to all authenticated clients.");
    }
}
