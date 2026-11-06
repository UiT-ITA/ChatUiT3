using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Directory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUiT.Server.Controllers;

/// <summary>Entra group lookup for the group pickers on the admin pages.</summary>
[ApiController]
[Route("api/admin/groups")]
[Authorize(Roles = "Admin")]
public class AdminGroupsController : ControllerBase
{
    private readonly IGroupDirectoryService _groups;

    public AdminGroupsController(IGroupDirectoryService groups)
    {
        _groups = groups;
    }

    /// <summary>Search by display name prefix or by object id.</summary>
    [HttpGet]
    public async Task<ActionResult<List<DirectoryGroupDto>>> Search([FromQuery] string query, CancellationToken ct)
    {
        return Ok((await _groups.SearchAsync(query, ct)).ToList());
    }

    /// <summary>Names for a set of stored ids.</summary>
    [HttpPost("resolve")]
    public async Task<ActionResult<List<DirectoryGroupDto>>> Resolve([FromBody] List<string> ids, CancellationToken ct)
    {
        return Ok((await _groups.ResolveAsync(ids ?? [], ct)).ToList());
    }
}
