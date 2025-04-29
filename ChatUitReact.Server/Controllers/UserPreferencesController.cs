using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/user/preferences")]
[Authorize("DefaultAuth")]
public class UserPreferencesController : ControllerBase
{
    private readonly DummyService _dummyService;
    private readonly UserService _userService;

    public UserPreferencesController(DummyService dummyService, UserService userService)
    {
        _dummyService = dummyService;
        _userService = userService;
    }

    // GET api/user/preferences
    [HttpGet]
    public ActionResult<UserPreferencesDto> GetPreferences()
    {
        var userId = _userService.GetCurrentUserId(User);
        var preferences = _dummyService.GetUserPreferences(userId);
        return Ok(preferences);
    }

    // PUT api/user/preferences
    [HttpPut]
    public ActionResult<UserPreferencesDto> UpdatePreferences(UserPreferencesDto preferencesDto)
    {
        var userId = _userService.GetCurrentUserId(User);
        var updatedPreferences = _dummyService.UpdateUserPreferences(userId, preferencesDto);
        return Ok(updatedPreferences);
    }
}
