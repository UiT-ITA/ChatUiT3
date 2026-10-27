using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Functions;
using ChatUiT.Server.Services.Knowledge;

namespace ChatUiT.Server.Services.Agents.M365.Knowledge;

/// <summary>Sender and subject of inbox mail received since the start of yesterday.</summary>
public sealed class RecentMailKnowledgeSource : IKnowledgeSource
{
    private const int MaxMessages = 100;
    private static readonly string[] Scopes = [M365Scopes.MailRead];
    private readonly GraphClient _graph;

    public RecentMailKnowledgeSource(GraphClient graph) => _graph = graph;

    public string Id => "m365_recent_mail";
    public string DisplayName => "Recent email";
    public string Description => "Sender and subject of the mail in your inbox received today and yesterday.";
    public string Group => M365Knowledge.Group;
    public ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;
    public IReadOnlyList<string> RequiredScopes => Scopes;

    public async Task<string?> LoadAsync(KnowledgeSourceContext context, CancellationToken ct)
    {
        var yesterday = context.Today.AddDays(-1);
        var response = await _graph.GetAsync(context.Run,
            $"me/mailFolders/inbox/messages?$filter=receivedDateTime ge {M365Knowledge.Iso(context.StartOfDayUtc(yesterday))}" +
            $"&$orderby=receivedDateTime desc&$top={MaxMessages}&$select=from,subject,receivedDateTime,isRead",
            Scopes, ct);

        var messages = response.Items().ToList();
        if (messages.Count == 0)
        {
            return $"No mail has arrived in the inbox since {M365Knowledge.Day(yesterday)}.";
        }

        var text = new StringBuilder($"Inbox mail received since {M365Knowledge.Day(yesterday)}, newest first.");
        if (M365Knowledge.HasMore(response))
        {
            text.Append($" Only the newest {MaxMessages} are listed.");
        }

        foreach (var message in messages)
        {
            var from = message.TryGetProperty("from", out var sender) ? MailSupport.Person(sender) : "Unknown sender";
            text.Append($"\n- {M365Knowledge.Time(context, message.Str("receivedDateTime"))} | From: {from} | Subject: {M365Knowledge.Clip(message.Str("subject"))}");
            if (message.Str("isRead") == "false")
            {
                text.Append(" | unread");
            }
        }

        return text.ToString();
    }
}
