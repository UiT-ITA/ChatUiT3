using Microsoft.AspNetCore.SignalR;

namespace ChatUitReact.Server.Hubs;

public interface ITestClient
{
    Task ReceiveMessage(string message);
}

internal sealed class TestHub : Hub<ITestClient>
{
    public override async Task OnConnectedAsync()
    {
        await Clients.All.ReceiveMessage($"{Context.ConnectionId} - Connected");
        Console.WriteLine("User connected to TestHub: {0}, ConnectionId: {1}",
    Context.User?.Identity?.Name, Context.ConnectionId);
        await base.OnConnectedAsync();
    }
}
