using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using ChatUitReact.Server.Models;
using System.Linq;
using System.Collections.Concurrent;

namespace ChatUitReact.Server.Hubs;

public interface IChatHubClient
{
    Task ReceiveMessageChunk(string chatId, string messageId, string chunk);
    Task ChatUpdated(string chatId);
    Task ChatListUpdated();
    Task AssistantsChanged();
    Task Error(string message);
}

[Authorize]
public partial class ChatHub : Hub<IChatHubClient>
{
    private readonly UserService _userService;
    private readonly ILogger<ChatHub> _logger;
    private readonly IChatService _chatService;
    private readonly StreamingMessageService _streamingMessageService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IAssistantService _assistantService;
    private readonly IModelService _modelService;
    private static readonly ConcurrentDictionary<string, string> _connections = new ConcurrentDictionary<string, string>();

    public ChatHub(UserService userService, ILogger<ChatHub> logger, IChatService chatService, StreamingMessageService streamingMessageService, IHubContext<ChatHub> hubContext, IAssistantService assistantService, IModelService modelService)
    {
        _userService = userService;
        _logger = logger;
        _chatService = chatService;
        _streamingMessageService = streamingMessageService;
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
        _streamingMessageService.CancelClientStream(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
