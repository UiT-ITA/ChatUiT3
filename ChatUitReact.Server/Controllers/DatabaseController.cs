using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DatabaseController : ControllerBase
    {
        private readonly DatabaseService _databaseService;

        public DatabaseController(DatabaseService databaseService)
        {
            _databaseService = databaseService;
        }

        [HttpGet("test-connection")]
        public async Task<IActionResult> TestConnection()
        {
            var isConnected = await _databaseService.TestConnectionAsync();
            if (isConnected)
            {
                return Ok("Successfully connected to the database!");
            }
            return StatusCode(500, "Failed to connect to the database.");
        }
    }
}
