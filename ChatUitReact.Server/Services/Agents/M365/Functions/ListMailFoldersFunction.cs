using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListMailFoldersArgs(
    [property: Description(MailSupport.MailboxDescription)]
    string? Mailbox);

public sealed class ListMailFoldersFunction : Tool<ListMailFoldersArgs>
{
    private readonly GraphClient _graph;

    public ListMailFoldersFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_mail_folders";
    public override string DisplayName => "List mail folders";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List top-level mail folders with id, name and unread count. Well-known names (inbox, sentitems, drafts, archive, deleteditems) work anywhere a folder is asked for.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(ListMailFoldersArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var response = await _graph.GetAsync(invocation.Context,
            $"{GraphClient.UserPath(args.Mailbox)}/mailFolders?$top=100&$select=id,displayName,unreadItemCount,totalItemCount",
            MailSupport.ReadScopes, ct);

        var folders = response.Items().Select(f => new
        {
            id = f.Str("id"),
            name = f.Str("displayName"),
            unread = f.Str("unreadItemCount"),
            total = f.Str("totalItemCount")
        }).ToList();

        return ToolResult.Ok(new { count = folders.Count, folders });
    }
}
