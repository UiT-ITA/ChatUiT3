using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record CreateGroupChatArgs(
    [property: Description("Ids or emails of the other participants (the signed-in user is added automatically). At least two.")]
    List<string> UserIdsOrEmails,
    [property: Description("Chat topic shown in Teams.")]
    string? Topic,
    [property: Description("A first message to post after creating the chat.")]
    string? FirstMessage);

public sealed class CreateGroupChatFunction : ConfirmableTool<CreateGroupChatArgs>
{
    private readonly GraphClient _graph;

    public CreateGroupChatFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_group_chat";
    public override string DisplayName => "Create Teams group chat";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Create a Teams group chat with two or more people, optionally with a topic and a first message. The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => TeamsChatSupport.SendScopes;

    protected override async Task<ToolPreview> PrepareAsync(CreateGroupChatArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var people = await ResolveAllAsync(args, invocation.Context, ct);

        var fields = new List<ToolPreviewField>
        {
            new("Participants", string.Join(", ", people.Select(p => p.Email == null ? p.DisplayName : $"{p.DisplayName} ({p.Email})")))
        };
        if (!string.IsNullOrWhiteSpace(args.Topic))
        {
            fields.Add(new ToolPreviewField("Topic", args.Topic));
        }

        if (!string.IsNullOrWhiteSpace(args.FirstMessage))
        {
            fields.Add(new ToolPreviewField("First message", args.FirstMessage, Multiline: true));
        }

        return new ToolPreview("Create Teams group chat", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CreateGroupChatArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var people = await ResolveAllAsync(args, invocation.Context, ct);
        var me = await TeamsChatSupport.MeAsync(_graph, invocation.Context, ct);

        var chat = await TeamsChatSupport.CreateChatAsync(_graph, invocation.Context, "group", people.Select(p => p.Id).Append(me.Id), args.Topic, ct);
        var chatId = chat.Str("id")!;

        string? messageId = null;
        if (!string.IsNullOrWhiteSpace(args.FirstMessage))
        {
            var sent = await TeamsChatSupport.SendAsync(_graph, invocation.Context, chatId, args.FirstMessage, ct);
            messageId = sent.Str("id");
        }

        return ToolResult.Ok(new { created = true, chatId, webUrl = chat.Str("webUrl"), messageId }, "Group chat created.");
    }

    private async Task<List<TeamsChatSupport.Person>> ResolveAllAsync(CreateGroupChatArgs args, ToolExecutionContext context, CancellationToken ct)
    {
        var ids = args.UserIdsOrEmails.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).Distinct().ToList();
        if (ids.Count < 2)
        {
            throw new ToolArgumentException("A group chat needs at least two other participants.");
        }

        var people = new List<TeamsChatSupport.Person>(ids.Count);
        foreach (var id in ids)
        {
            people.Add(await TeamsChatSupport.ResolveAsync(_graph, context, id, ct));
        }

        return people;
    }
}
