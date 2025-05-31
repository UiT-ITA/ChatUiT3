using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/admin/assistants")]
    [Authorize(Roles = "Admin")] // Restrict to admin role
    public class AdminAssistantsController : ControllerBase
    {
        private readonly DatabaseService _databaseService;
        private readonly UserService _userService;
        private readonly ILogger<AdminAssistantsController> _logger;
        private const string SystemOwner = "System";

        public AdminAssistantsController(
            DatabaseService databaseService,
            UserService userService,
            ILogger<AdminAssistantsController> logger)
        {
            _databaseService = databaseService;
            _userService = userService;
            _logger = logger;
        }


    }
}
