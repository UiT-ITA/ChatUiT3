using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using ChatUitReact.Server.Models.DTOs;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Models;
using System.Linq;

namespace ChatUitReact.Server.Hubs;

public interface IChatHubClient
{
    Task ChatListUpdated(List<AiChatHeader> chats);
    Task ChatUpdated(AiChat chat);
    Task ReceiveMessageChunk(string chatId, string messageId, string chunk);
    Task ChatCreated(string chatId);
    Task UserAssistants(AssistantListDto assistants);
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
    private static readonly Dictionary<string, string> _connections = new Dictionary<string, string>();

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

    public async Task<ModelDto[]> GetAvailableModels()
    {
        // For now, just return all models. In a real system, you'd filter by user roles
        var models = await _modelService.GetAllModelsAsync();
        return models.Select(m => new ModelDto
        {
            Id = m.Id,
            ModelName = m.ModelName,
            EndpointId = m.EndpointId,
            AllowedRoles = m.AllowedRoles
        }).ToArray();
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        var chats = await _chatService.GetChatListAsync(userId);
        await Clients.Caller.ChatListUpdated(chats);
        _connections.Add(Context.ConnectionId, userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetCurrentUserId();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
        if (_connections.ContainsKey(Context.ConnectionId))
        {
            _connections.Remove(Context.ConnectionId);
        }
        _streamingMessageService.CancelClientStream(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
