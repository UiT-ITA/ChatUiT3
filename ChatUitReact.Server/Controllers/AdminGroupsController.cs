using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Directory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

/// <summary>Entra group lookup for the group pickers on the admin pages.</summary>
[ApiController]
[Route("api/admin/groups")]
[Authorize(Roles = "Admin")]
public class AdminGroupsController : ControllerBase
{
    private readonly IGroupDirectoryService _groups;
    private readonly ILogger<AdminGroupsController> _logger;

    public AdminGroupsController(IGroupDirectoryService groups, ILogger<AdminGroupsController> logger)
    {
        _groups = groups;
        _logger = logger;
    }

    /// <summary>Search by display name prefix or by object id.</summary>
    [HttpGet]
    public async Task<ActionResult<List<DirectoryGroupDto>>> Search([FromQuery] string query, CancellationToken ct)
    {
        try
        {
            return Ok((await _groups.SearchAsync(query, ct)).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Group search failed");
            return StatusCode(502, ex.Message);
        }
    }

    /// <summary>Names for a set of stored ids.</summary>
    [HttpPost("resolve")]
    public async Task<ActionResult<List<DirectoryGroupDto>>> Resolve([FromBody] List<string> ids, CancellationToken ct)
    {
        try
        {
            return Ok((await _groups.ResolveAsync(ids ?? [], ct)).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Group resolve failed");
            return StatusCode(502, ex.Message);
        }
    }
}
