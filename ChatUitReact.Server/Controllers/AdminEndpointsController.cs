using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/admin/endpoints")]
    [Authorize(Roles = "Admin")] // Restrict to admin role
    public class AdminEndpointsController : ControllerBase
    {
        private readonly DatabaseService _databaseService;
        private readonly UserService _userService;
        private readonly ILogger<AdminEndpointsController> _logger;

        public AdminEndpointsController(
            DatabaseService databaseService,
            UserService userService,
            ILogger<AdminEndpointsController> logger)
        {
            _databaseService = databaseService;
            _userService = userService;
            _logger = logger;
        }
    }
}
