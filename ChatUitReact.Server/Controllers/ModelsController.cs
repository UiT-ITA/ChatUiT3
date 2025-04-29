using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize("DefaultAuth")]
public class ModelsController : ControllerBase
{
    private readonly DummyService _dummyService;

    public ModelsController(DummyService dummyService)
    {
        _dummyService = dummyService;
    }

    // GET api/models
    [HttpGet]
    public ActionResult<IEnumerable<AiModelDto>> GetModels()
    {
        var models = _dummyService.GetAvailableModels();
        return Ok(models);
    }
}
