using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;

namespace ChatUitReact.Server.Tests;

/// <summary>
/// Covers the registry that lets one request stop a generation running in another: ownership,
/// idempotency, and telling a user cancel apart from the generation timeout, which fires the
/// same token but must still land on the error path.
/// </summary>
public class StreamingServiceCancellationTests
{
    private const string UserId = "user-1";
    private const string MessageId = "message-1";

    private static StreamingService CreateService() =>
        new(NullLogger<StreamingService>.Instance, new StubHubContext());

    [Fact]
    public void TryCancelGeneration_ActiveGeneration_CancelsTokenAndFlagsUserCancel()
    {
        var service = CreateService();
        using var cts = new CancellationTokenSource();
        service.RegisterGeneration(UserId, MessageId, cts);

        var cancelled = service.TryCancelGeneration(UserId, MessageId);

        Assert.True(cancelled);
        Assert.True(cts.IsCancellationRequested);
        Assert.True(service.WasCancelledByUser(UserId, MessageId));
    }

    [Fact]
    public void TryCancelGeneration_AfterUnregister_IsANoOp()
    {
        // The generation finished between the user clicking cancel and the request arriving.
        var service = CreateService();
        using var cts = new CancellationTokenSource();
        service.RegisterGeneration(UserId, MessageId, cts);
        service.UnregisterGeneration(UserId, MessageId);

        var cancelled = service.TryCancelGeneration(UserId, MessageId);

        Assert.False(cancelled);
        Assert.False(cts.IsCancellationRequested);
        Assert.False(service.WasCancelledByUser(UserId, MessageId));
    }

    [Fact]
    public void TryCancelGeneration_CalledTwice_IsIdempotent()
    {
        var service = CreateService();
        using var cts = new CancellationTokenSource();
        service.RegisterGeneration(UserId, MessageId, cts);

        Assert.True(service.TryCancelGeneration(UserId, MessageId));
        Assert.True(service.TryCancelGeneration(UserId, MessageId));
        Assert.True(service.WasCancelledByUser(UserId, MessageId));
    }

    [Fact]
    public void TryCancelGeneration_OtherUsersMessage_IsANoOp()
    {
        var service = CreateService();
        using var cts = new CancellationTokenSource();
        service.RegisterGeneration(UserId, MessageId, cts);

        var cancelled = service.TryCancelGeneration("someone-else", MessageId);

        Assert.False(cancelled);
        Assert.False(cts.IsCancellationRequested);
    }

    [Fact]
    public void WasCancelledByUser_TimeoutCancellation_IsFalse()
    {
        // The timeout fires the same token; only a user cancel undoes the send.
        var service = CreateService();
        using var cts = new CancellationTokenSource();
        service.RegisterGeneration(UserId, MessageId, cts);

        cts.Cancel();

        Assert.True(cts.IsCancellationRequested);
        Assert.False(service.WasCancelledByUser(UserId, MessageId));
    }

    private sealed class StubHubContext : IHubContext<ChatHub, IChatHubClient>
    {
        // The cancellation registry never notifies anyone; anything else is a test bug.
        public IHubClients<IChatHubClient> Clients => throw new NotSupportedException();
        public IGroupManager Groups => throw new NotSupportedException();
    }
}
