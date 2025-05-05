using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;

public interface IChatHubClient
{
    
}

namespace ChatUitReact.Server.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly UserService _userService;
        private readonly ILogger<ChatHub> _logger;

        public ChatHub(UserService userService, ILogger<ChatHub> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                // Try to get user ID, but don't fail if auth is not working
                string userId = "anonymous";

                try
                {
                    if (Context.User?.Identity?.IsAuthenticated == true)
                    {
                        userId = _userService.GetCurrentUserId(Context.User);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error getting user ID, continuing with anonymous");
                }

                _logger.LogInformation("User connected to ChatHub: {UserId}, ConnectionId: {ConnectionId}",
                    userId, Context.ConnectionId);

                // Add to a user-specific group
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);

                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnConnectedAsync");
                throw;
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            string userId = "anonymous";

            try
            {
                if (Context.User?.Identity?.IsAuthenticated == true)
                {
                    userId = _userService.GetCurrentUserId(Context.User);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error getting user ID during disconnect");
            }

            _logger.LogInformation("User disconnected from ChatHub: {UserId}, ConnectionId: {ConnectionId}",
                userId, Context.ConnectionId);

            // Remove from user-specific group
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            await base.OnDisconnectedAsync(exception);
        }
    }
}