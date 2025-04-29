using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize("DefaultAuth")]
public class ToolsController : ControllerBase
{
    private readonly DummyService _dummyService;

    public ToolsController(DummyService dummyService)
    {
        _dummyService = dummyService;
    }

    // GET api/tools
    [HttpGet]
    public ActionResult<IEnumerable<AiChatToolDto>> GetTools()
    {
        var tools = _dummyService.GetAvailableTools();
        return Ok(tools);
    }
}
