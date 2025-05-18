using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/admin/models")]
    [Authorize(Roles = "Admin")] // Restrict to admin role
    public class AdminModelsController : ControllerBase
    {
        private readonly DatabaseService _databaseService;
        private readonly UserService _userService;
        private readonly ILogger<AdminModelsController> _logger;

        public AdminModelsController(
            DatabaseService databaseService,
            UserService userService,
            ILogger<AdminModelsController> logger)
        {
            _databaseService = databaseService;
            _userService = userService;
            _logger = logger;
        }
    }
}
