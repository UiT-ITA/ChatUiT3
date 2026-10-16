using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record GetPresenceArgs(
    [property: Description("User ids (GUIDs from find_people or get_user). Up to 20.")]
    List<string> UserIds);

public sealed class GetPresenceFunction : Tool<GetPresenceArgs>
{
    private static readonly string[] Scopes = [M365Scopes.PresenceReadAll];
    private readonly GraphClient _graph;

    public GetPresenceFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_presence";
    public override string DisplayName => "Get presence";
    public override string Description => "Get Teams presence (Available, Busy, Away, Offline, ...) for one or more users by id. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetPresenceArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var ids = args.UserIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().Take(20).ToList();
        if (ids.Count == 0)
        {
            return ToolResult.Error("userIds must contain at least one id.");
        }

        var response = await _graph.PostAsync(invocation.Context, "communications/getPresencesByUserId", new { ids }, Scopes, ct);
        var presences = response.Items().Select(p => new
        {
            userId = p.Str("id"),
            availability = p.Str("availability"),
            activity = p.Str("activity"),
            statusMessage = p.Str("statusMessage", "message", "content")
        });

        return ToolResult.Ok(new { presences });
    }
}
