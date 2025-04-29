using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize("DefaultAuth")]
public class AssistantsController : ControllerBase
{
    private readonly DummyService _dummyService;
    private readonly UserService _userService;

    public AssistantsController(DummyService dummyService, UserService userService)
    {
        _dummyService = dummyService;
        _userService = userService;
    }

    // GET api/assistants
    [HttpGet]
    public ActionResult<IEnumerable<AiAssistantDto>> GetAssistants()
    {
        var userId = _userService.GetCurrentUserId(User);
        var assistants = _dummyService.GetAssistants(userId);
        return Ok(assistants);
    }

    // GET api/assistants/{id}
    [HttpGet("{id}")]
    public ActionResult<AiAssistantDto> GetAssistant(string id)
    {
        var assistant = _dummyService.GetAssistant(id);
        
        if (assistant == null)
            return NotFound();
            
        return Ok(assistant);
    }

    // POST api/assistants
    [HttpPost]
    public ActionResult<AiAssistantDto> CreateAssistant(AiAssistantCreateDto createDto)
    {
        var userId = _userService.GetCurrentUserId(User);
        var assistant = _dummyService.CreateAssistant(userId, createDto);
        return CreatedAtAction(nameof(GetAssistant), new { id = assistant.Id }, assistant);
    }
}
