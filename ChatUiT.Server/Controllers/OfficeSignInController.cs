using System.Text.RegularExpressions;
using ChatUiT.Server.Services.OfficeSignIn;
using ChatUiT.Server.Services.Training;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUiT.Server.Controllers;

/// <summary>
/// The relay of the Office add-in's browser sign-in. The sign-in page in the user's browser posts
/// the authorization code under a random sign-in id, and the task pane polls for it with the same id.
/// Both calls are anonymous.
/// </summary>
[ApiController]
[Route("api/v1/office/sign-in")]
[AllowAnonymous]
[AllowWithoutTraining]
public partial class OfficeSignInController : ControllerBase
{
    public const int MaxCodeLength = 4096;
    public const int MaxErrorLength = 1000;

    private readonly OfficeSignInRelay _relay;

    public OfficeSignInController(OfficeSignInRelay relay)
    {
        _relay = relay;
    }

    /// <summary>Stores the code or the error. 409 when the id already has a result.</summary>
    [HttpPost("{id}")]
    public IActionResult Put(string id, [FromBody] OfficeSignInResultDto body)
    {
        if (!IsValidId(id))
        {
            return BadRequest();
        }

        var hasCode = !string.IsNullOrEmpty(body.Code);
        var hasError = !string.IsNullOrEmpty(body.Error);
        if (hasCode == hasError ||
            (body.Code?.Length ?? 0) > MaxCodeLength ||
            (body.Error?.Length ?? 0) > MaxErrorLength)
        {
            return BadRequest();
        }

        return _relay.TryPut(id, new OfficeSignInResult(body.Code, body.Error)) ? NoContent() : Conflict();
    }

    /// <summary>Returns and removes the result. 204 while there is none yet.</summary>
    [HttpGet("{id}")]
    public IActionResult Take(string id)
    {
        if (!IsValidId(id))
        {
            return BadRequest();
        }

        var result = _relay.Take(id);
        return result is null ? NoContent() : Ok(new OfficeSignInResultDto { Code = result.Code, Error = result.Error });
    }

    /// <summary>A sign-in id is 32 random bytes in base64url: 43 characters.</summary>
    private static bool IsValidId(string id) => IdPattern().IsMatch(id);

    [GeneratedRegex("^[A-Za-z0-9_-]{43}$")]
    private static partial Regex IdPattern();
}

public sealed class OfficeSignInResultDto
{
    public string? Code { get; init; }
    public string? Error { get; init; }
}
