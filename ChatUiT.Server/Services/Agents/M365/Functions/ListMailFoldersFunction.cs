using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ListMailFoldersArgs(
    [property: Description(MailSupport.MailboxDescription)]
    string? Mailbox);

public sealed class ListMailFoldersFunction : Tool<ListMailFoldersArgs>
{
    private const string Fields = "id,displayName,unreadItemCount,totalItemCount,childFolderCount";
    private const int MaxFolders = 500;
    private const int MaxConcurrentRequests = 4;

    private readonly GraphClient _graph;

    public ListMailFoldersFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_mail_folders";
    public override string DisplayName => "List mail folders";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => $"List all mail folders as a tree, including folders nested inside other folders, with id, name, unread count and total count. At most {MaxFolders} folders; truncated is true when more exist. Well-known names (inbox, sentitems, drafts, archive, deleteditems) work anywhere a folder is asked for. Other folders, nested ones included, are given by id.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(ListMailFoldersArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var walk = new Walk(_graph, invocation, GraphClient.UserPath(args.Mailbox), ct);
        var folders = await walk.BuildAllAsync(await walk.FetchAsync($"{walk.Owner}/mailFolders"));

        return ToolResult.Ok(new { count = walk.Count, truncated = walk.Truncated, folders });
    }

    /// <summary>One listing of a mailbox's folder tree: shared request limit, folder count and truncation.</summary>
    private sealed class Walk(GraphClient graph, ToolInvocation invocation, string owner, CancellationToken ct)
    {
        private readonly SemaphoreSlim _requests = new(MaxConcurrentRequests);
        private int _count;

        public string Owner => owner;
        public int Count => Math.Min(_count, MaxFolders);
        public bool Truncated { get; private set; }

        /// <summary>All pages of the folders at <paramref name="path"/>, each with its first level of child folders expanded.</summary>
        public async Task<List<JsonElement>> FetchAsync(string path)
        {
            var items = new List<JsonElement>();
            string? page = $"{path}?$top=100&$select={Fields}&$expand=childFolders($select={Fields})";
            while (page != null)
            {
                if (_count >= MaxFolders)
                {
                    Truncated = true;
                    break;
                }

                JsonElement response;
                await _requests.WaitAsync(ct);
                try
                {
                    response = await graph.GetAsync(invocation.Context, page, MailSupport.ReadScopes, ct);
                }
                finally
                {
                    _requests.Release();
                }

                items.AddRange(response.Items());
                page = GraphClient.NextPage(response);
            }

            return items;
        }

        /// <summary>The folders built from <paramref name="items"/>, skipping entries without an id and folders past the limit.</summary>
        public async Task<List<MailFolder>> BuildAllAsync(IEnumerable<JsonElement> items)
            => (await Task.WhenAll(items.Where(f => !string.IsNullOrEmpty(f.Str("id"))).Select(BuildAsync)))
                .OfType<MailFolder>()
                .ToList();

        /// <summary>The folder with its child folders filled in, or null when the limit is reached.</summary>
        private async Task<MailFolder?> BuildAsync(JsonElement folder)
        {
            if (Interlocked.Increment(ref _count) > MaxFolders)
            {
                Truncated = true;
                return null;
            }

            var id = folder.Str("id")!;
            var children = folder.Items("childFolders").ToList();
            string? error = null;
            if (int.TryParse(folder.Str("childFolderCount"), out var childCount) && childCount > children.Count)
            {
                try
                {
                    children = await FetchAsync($"{owner}/mailFolders/{Uri.EscapeDataString(id)}/childFolders");
                }
                catch (GraphRequestException ex)
                {
                    error = ex.Message;
                }
            }

            return new MailFolder(id, folder.Str("displayName"), folder.Str("unreadItemCount"), folder.Str("totalItemCount"), await BuildAllAsync(children), error);
        }
    }

    private sealed record MailFolder(
        string Id,
        string? Name,
        string? Unread,
        string? Total,
        List<MailFolder> Folders,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FoldersError);
}
