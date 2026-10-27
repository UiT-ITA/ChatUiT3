using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using ChatUiT.Server.Services.Knowledge;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUiT.Server.Controllers;

[ApiController]
[Route("api/knowledge-sources")]
[Authorize]
public class KnowledgeSourcesController : ControllerBase
{
    private readonly IKnowledgeSourceRegistry _registry;
    private readonly UserService _userService;

    public KnowledgeSourcesController(IKnowledgeSourceRegistry registry, UserService userService)
    {
        _registry = registry;
        _userService = userService;
    }

    [HttpGet]
    public ActionResult<List<KnowledgeSourceDto>> GetKnowledgeSources()
        => Ok(_registry.ForUser(_userService.GetUserAccess(User)).Select(source => new KnowledgeSourceDto
        {
            Id = source.Id,
            DisplayName = source.DisplayName,
            Description = source.Description,
            Group = source.Group
        }).ToList());
}
