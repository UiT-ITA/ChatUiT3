using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/files")]
[Authorize("DefaultAuth")]
public class FilesController : ControllerBase
{
    private readonly DummyService _dummyService;
    private readonly UserService _userService;

    public FilesController(DummyService dummyService, UserService userService)
    {
        _dummyService = dummyService;
        _userService = userService;
    }

    // POST api/files
    [HttpPost]
    public async Task<ActionResult<AiChatFileDto>> UploadFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var userId = _userService.GetCurrentUserId(User);
        
        // Process file
        var fileDto = _dummyService.UploadFile(
            userId, 
            file.FileName, 
            file.ContentType, 
            file.Length);
        
        return Ok(fileDto);
    }
}
