using ChatUiT.Server.Models.Insights;
using ChatUiT.Server.Services.Insights;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUiT.Server.Controllers;

/// <summary>The telemetry of the Insights page, read live from Application Insights. Admins only.</summary>
[ApiController]
[Route("api/insights")]
[Authorize(Roles = "Admin")]
public class InsightsController : ControllerBase
{
    private readonly IInsightsService _insights;

    public InsightsController(IInsightsService insights)
    {
        _insights = insights;
    }

    /// <summary>The results of every query of a page over a range: 1h, 24h (the default), 7d or 30d.</summary>
    [HttpGet("{page}")]
    public async Task<ActionResult<InsightsPageDto>> GetPage(string page, [FromQuery] string? range, CancellationToken cancellationToken)
    {
        if (!InsightsQueries.Pages.ContainsKey(page))
        {
            return NotFound();
        }

        var timeRange = InsightsRange.Find(range);
        if (timeRange == null)
        {
            return BadRequest($"Unknown range. Use one of {string.Join(", ", InsightsRange.All.Select(item => item.Key))}.");
        }

        return Ok(await _insights.GetPageAsync(page, timeRange, cancellationToken));
    }
}
