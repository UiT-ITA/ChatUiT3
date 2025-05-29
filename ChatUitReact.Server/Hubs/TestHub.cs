using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Hubs;

public interface ITestClient
{
    Task ReceiveMessage(string message);
}

public class TestHub : Hub<ITestClient>
{
    public override async Task OnConnectedAsync()
    {
        await Clients.All.ReceiveMessage($"{Context.ConnectionId} - Connected");
        Console.WriteLine("User connected to TestHub: {0}, ConnectionId: {1}",
            Context.User?.Identity?.Name, Context.ConnectionId);
        await base.OnConnectedAsync();
    }
}

[Authorize]
public class TestAuthHub : Hub<ITestClient>
{
    private readonly ILogger<TestAuthHub> _logger;
    private readonly UserService _userService;

    public TestAuthHub(ILogger<TestAuthHub> logger, UserService userService)
    {
        _logger = logger;
        _userService = userService;
    }

    public override async Task OnConnectedAsync()
    {
        // Debug log all claims using the centralized service
        //_userService.LogAllClaims(Context.User, "TestAuthHub connection");

        // Get comprehensive user identity
        if (Context.User == null)
        {
            _logger.LogWarning("User context is null in TestAuthHub");
            return;
        }
        
        var userIdentity = _userService.GetUserIdentity(Context.User);

        // Send user-specific connection info to clients
        await Clients.All.ReceiveMessage(
            $"{userIdentity.DisplayName} connected with connection ID: {Context.ConnectionId}");

        _logger.LogInformation(
            "Authenticated user connected: {UserInfo}, ConnectionId: {ConnectionId}",
            userIdentity, Context.ConnectionId);

        await base.OnConnectedAsync();
    }

    // Get detailed user information
    public object GetUserInfo()
    {
        if (Context.User == null)
        {
            _logger.LogWarning("User context is null in GetUserInfo");
            return new { Error = "User context is null" };
        }
        
        var identity = _userService.GetUserIdentity(Context.User);

        // Return anonymized object with user details
        return new
        {
            identity.Username,
            identity.DisplayName,
            identity.FirstName,
            identity.LastName,
            identity.Email,
            identity.Roles,
            ConnectionId = Context.ConnectionId
        };
    }
}
