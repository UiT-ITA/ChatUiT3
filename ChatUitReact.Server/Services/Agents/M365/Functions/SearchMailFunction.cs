using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record SearchMailArgs(
    [property: Description("Outlook search, e.g. 'budget from:kari@uit.no received>=2026-10-01'. Omit to list the newest emails.")]
    string? Query,
    [property: Description("Folder id or well-known name. Defaults to inbox when listing, all folders when searching.")]
    string? Folder,
    [property: Description(MailSupport.MailboxDescription)]
    string? Mailbox,
    [property: Description("Only unread emails.")]
    bool? UnreadOnly,
    [property: Description("How many emails to return, 1 to 50. Defaults to 20.")]
    int? Top);

public sealed class SearchMailFunction : Tool<SearchMailArgs>
{
    private readonly GraphClient _graph;

    public SearchMailFunction(GraphClient graph) => _graph = graph;

    public override string Id => "search_mail";
    public override string DisplayName => "Search mail";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Find emails by Outlook search, or list the newest in a folder. Returns id, subject, sender, received time and a preview. Read one in full with get_mail.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(SearchMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var top = Math.Clamp(args.Top ?? 20, 1, 50);
        var owner = GraphClient.UserPath(args.Mailbox);
        var folder = string.IsNullOrWhiteSpace(args.Folder) ? null : Uri.EscapeDataString(args.Folder.Trim());
        var unreadOnly = args.UnreadOnly == true;

        string path;
        if (!string.IsNullOrWhiteSpace(args.Query))
        {
            // $search cannot be combined with $filter or $orderby; unread is filtered below.
            var query = Uri.EscapeDataString($"\"{args.Query.Replace("\"", string.Empty).Trim()}\"");
            var scope = folder == null ? $"{owner}/messages" : $"{owner}/mailFolders/{folder}/messages";
            path = $"{scope}?$search={query}&$top={top}&$select={MailSupport.SummaryFields}";
        }
        else
        {
            // Graph wants the $orderby property to lead the $filter.
            var filter = "receivedDateTime ge 1900-01-01T00:00:00Z" + (unreadOnly ? " and isRead eq false" : string.Empty);
            path = $"{owner}/mailFolders/{folder ?? "inbox"}/messages?$filter={Uri.EscapeDataString(filter)}&$orderby=receivedDateTime desc&$top={top}&$select={MailSupport.SummaryFields}";
        }

        var response = await _graph.GetAsync(invocation.Context, path, MailSupport.ReadScopes, ct);

        var messages = response.Items()
            .Where(m => !unreadOnly || m.Str("isRead") != "true")
            .Select(MailSupport.Summary)
            .ToList();

        return ToolResult.Ok(new { count = messages.Count, messages });
    }
}
