using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;
using ChatUiT.Server.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace ChatUiT.Server.Controllers;

/// <summary>
/// Toolboxes are code, so this controller only edits who may use them. A stored policy overrides
/// the toolbox's code default; deleting it goes back to the default.
/// </summary>
[ApiController]
[Route("api/admin/tools")]
[Authorize(Roles = "Admin")]
public class AdminToolsController : ControllerBase
{
    private readonly IToolboxRegistry _registry;
    private readonly IToolAccessService _access;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    private readonly ILogger<AdminToolsController> _logger;

    public AdminToolsController(
        IToolboxRegistry registry,
        IToolAccessService access,
        IHubContext<ChatHub, IChatHubClient> hubContext,
        ILogger<AdminToolsController> logger)
    {
        _registry = registry;
        _access = access;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<ToolAdminDto>>> GetTools()
    {
        try
        {
            var result = new List<ToolAdminDto>();
            foreach (var toolbox in _registry.All)
            {
                result.Add(await ToAdminDtoAsync(toolbox));
            }

            result.Add(await ClientToolsEntryAsync());
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing tools");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ToolAdminDto>> GetTool(string id)
    {
        try
        {
            if (id == ToolRegistry.ClientToolsPolicyId)
            {
                return Ok(await ClientToolsEntryAsync());
            }

            var toolbox = _registry.Find(id);
            return toolbox == null ? NotFound($"Tool {id} not found") : Ok(await ToAdminDtoAsync(toolbox));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tool {ToolId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut("{id}/policy")]
    public async Task<ActionResult<ToolAdminDto>> SetPolicy(string id, [FromBody] ToolAccessPolicyDto policyDto)
    {
        try
        {
            if (!IsKnown(id))
            {
                return NotFound($"Tool {id} not found");
            }

            var invalidGroups = (policyDto.AllowedGroupIds ?? []).Where(g => !Guid.TryParse(g?.Trim(), out _)).ToList();
            if (invalidGroups.Count > 0)
            {
                return BadRequest(new { error = "invalid_group_ids", groupIds = invalidGroups });
            }

            await _access.SetOverrideAsync(id, ToolMapping.ToPolicy(policyDto));
            await _hubContext.Clients.All.AssistantsUpdated();

            return Ok(await GetDtoAsync(id));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting policy for tool {ToolId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("{id}/policy")]
    public async Task<ActionResult<ToolAdminDto>> ResetPolicy(string id)
    {
        try
        {
            if (!IsKnown(id))
            {
                return NotFound($"Tool {id} not found");
            }

            await _access.ClearOverrideAsync(id);
            await _hubContext.Clients.All.AssistantsUpdated();

            return Ok(await GetDtoAsync(id));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting policy for tool {ToolId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    private bool IsKnown(string id) => id == ToolRegistry.ClientToolsPolicyId || _registry.Find(id) != null;

    private async Task<ToolAdminDto> GetDtoAsync(string id)
        => id == ToolRegistry.ClientToolsPolicyId ? await ClientToolsEntryAsync() : await ToAdminDtoAsync(_registry.Find(id)!);

    private async Task<ToolAdminDto> ToAdminDtoAsync(IToolbox toolbox)
        => ToolMapping.ToAdminDto(toolbox, _registry.ParentOf(toolbox.Id), await _access.GetEffectivePolicyAsync(toolbox.Id), await _access.GetStoredPolicyAsync(toolbox.Id));

    /// <summary>The gate for client-declared tools, shown as one row because there is one policy for all of them.</summary>
    private async Task<ToolAdminDto> ClientToolsEntryAsync()
    {
        var id = ToolRegistry.ClientToolsPolicyId;
        var stored = await _access.GetStoredPolicyAsync(id);
        return new ToolAdminDto
        {
            Id = id,
            Name = "Client tools",
            Description = "Tools declared and executed by the client application (browser, Office add-ins). This policy decides who may use any of them.",
            Execution = ToolExecution.Client,
            Classification = ClientTool.ClientClassification,
            DefaultPolicy = ToolMapping.ToDto(ToolAccessPolicy.Everyone),
            Policy = ToolMapping.ToDto(await _access.GetEffectivePolicyAsync(id)),
            IsOverridden = stored != null,
            UpdatedAt = stored?.UpdatedAt
        };
    }
}
