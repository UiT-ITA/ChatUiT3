using System;
using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>Read-only Microsoft 365 agent: people, mail, calendars and meetings, Teams, files and SharePoint, tasks and OneNote.</summary>
public sealed class M365ReaderAgent : InternalAgent
{
    public M365ReaderAgent(IServiceProvider services)
    {
        Functions = M365Functions.Reader.Select(t => (ITool)services.GetRequiredService(t)).ToList();
    }

    public override string Id => "m365_reader";

    public override string DisplayName => "Microsoft 365 (read)";

    public override string Description => "Reads the user's Microsoft 365: people and presence, mail, calendars and meetings (including transcripts), Teams chats and channels, files and SharePoint, To Do and Planner tasks, and OneNote.";

    public override string SystemPrompt => M365Prompts.Reader;

    public override IReadOnlyList<ITool> Functions { get; }
}
