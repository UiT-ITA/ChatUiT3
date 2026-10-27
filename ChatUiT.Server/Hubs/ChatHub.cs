using Microsoft.AspNetCore.SignalR;
using ChatUiT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using ChatUiT.Server.Models;
using System.Linq;
using System.Collections.Concurrent;

namespace ChatUiT.Server.Hubs;

public interface IChatHubClient
{
    Task ReceiveMessageChunk(string messageId, ChatStreamChunk chunk);
    Task ChatUpdated(string chatId);
    Task ChatListUpdated();
    Task AssistantsUpdated();
    Task Notify(NotifyLevel level, string message);
}

[Authorize]
public partial class ChatHub : Hub<IChatHubClient>
{
    private readonly UserService _userService;
    private readonly ILogger<ChatHub> _logger;
    private readonly IChatService _chatService;
    private readonly StreamingService _streamingService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;
    private static readonly ConcurrentDictionary<string, string> _connections = new ConcurrentDictionary<string, string>();

    public ChatHub(UserService userService, ILogger<ChatHub> logger, IChatService chatService, StreamingService streamingService, IHubContext<ChatHub> hubContext, IAssistantService assistantService, IModelService modelService)
    {
        _userService = userService;
        _logger = logger;
        _chatService = chatService;
        _streamingService = streamingService;
        _hubContext = hubContext;
        _assistantService = assistantService;
        _modelService = modelService;
    }

    private string GetCurrentUserId()
    {
        if (Context.User?.Identity?.IsAuthenticated == true)
        {
            return _userService.GetCurrentUserId(Context.User);
        }
        throw new UnauthorizedAccessException("User must be authenticated");
    }


    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        _connections.TryAdd(Context.ConnectionId, userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetCurrentUserId();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
        _connections.TryRemove(Context.ConnectionId, out _);
        await base.OnDisconnectedAsync(exception);
    }

    public Task StreamMessage(string messageId)
    {
        var userId = GetCurrentUserId();
        var clientId = Context.ConnectionId;
        
        _streamingService.StartClientStream(clientId, userId, messageId);
        
        return Task.CompletedTask;
    }
}
