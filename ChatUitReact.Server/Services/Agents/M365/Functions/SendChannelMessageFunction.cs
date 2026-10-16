using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record SendChannelMessageArgs(
    [property: Description("Team id from list_teams.")]
    string TeamId,
    [property: Description("Channel id from list_channels.")]
    string ChannelId,
    [property: Description("The plain-text message to post.")]
    string Text,
    [property: Description("Id of a post from get_channel_messages to reply to. Omit to start a new post.")]
    string? ReplyToMessageId);

/// <summary>Posts in a Teams channel after the user has approved the channel and text.</summary>
public sealed class SendChannelMessageFunction : ConfirmableTool<SendChannelMessageArgs>
{
    private static readonly string[] Scopes = [M365Scopes.ChannelMessageSend, M365Scopes.TeamReadBasicAll, M365Scopes.ChannelReadBasicAll, M365Scopes.ChannelMessageReadAll];
    private readonly GraphClient _graph;

    public SendChannelMessageFunction(GraphClient graph) => _graph = graph;

    public override string Id => "send_channel_message";
    public override string DisplayName => "Post in Teams channel";
    public override string Description => "Post a new message in a Teams channel, or reply to a post. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolPreview> PrepareAsync(SendChannelMessageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var channelPath = ChannelPath(args);
        var team = await _graph.GetAsync(invocation.Context, $"teams/{Uri.EscapeDataString(args.TeamId.Trim())}?$select=displayName", Scopes, ct);
        var channel = await _graph.GetAsync(invocation.Context, $"{channelPath}?$select=displayName", Scopes, ct);

        var fields = new List<ToolPreviewField> { new("Channel", $"{team.Str("displayName")} › {channel.Str("displayName")}") };
        if (!string.IsNullOrWhiteSpace(args.ReplyToMessageId))
        {
            var post = await _graph.GetAsync(invocation.Context, $"{channelPath}/messages/{Uri.EscapeDataString(args.ReplyToMessageId.Trim())}", Scopes, ct);
            var text = GraphJson.HtmlToText(post.Str("body", "content"));
            fields.Add(new ToolPreviewField("Reply to", $"{post.Str("from", "user", "displayName")}: {(text.Length > 300 ? text[..300] + "…" : text)}"));
        }

        fields.Add(new ToolPreviewField("Message", args.Text, Multiline: true));
        return new ToolPreview(string.IsNullOrWhiteSpace(args.ReplyToMessageId) ? "Post in Teams channel" : "Reply in Teams channel", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(SendChannelMessageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var path = $"{ChannelPath(args)}/messages";
        if (!string.IsNullOrWhiteSpace(args.ReplyToMessageId))
        {
            path += $"/{Uri.EscapeDataString(args.ReplyToMessageId.Trim())}/replies";
        }

        var sent = await _graph.PostAsync(invocation.Context, path, new { body = new { contentType = "text", content = args.Text } }, Scopes, ct);
        return ToolResult.Ok(new { sent = true, messageId = sent.Str("id"), webUrl = sent.Str("webUrl") }, "Message posted.");
    }

    private static string ChannelPath(SendChannelMessageArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.TeamId) || string.IsNullOrWhiteSpace(args.ChannelId) || string.IsNullOrWhiteSpace(args.Text))
        {
            throw new ToolArgumentException("teamId, channelId and text are required.");
        }

        return $"teams/{Uri.EscapeDataString(args.TeamId.Trim())}/channels/{Uri.EscapeDataString(args.ChannelId.Trim())}";
    }
}
