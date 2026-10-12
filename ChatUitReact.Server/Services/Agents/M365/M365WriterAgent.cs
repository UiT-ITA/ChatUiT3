using System;
using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>Everything the reader can do, plus sending mail and Teams messages and changing calendars, files, tasks and OneNote.</summary>
public sealed class M365WriterAgent : InternalAgent
{
    public M365WriterAgent(M365ReaderAgent reader, IServiceProvider services)
    {
        Functions = reader.Functions.Concat(M365Functions.Writer.Select(t => (ITool)services.GetRequiredService(t))).ToList();
    }

    public override string Id => "m365_writer";

    public override string DisplayName => "Microsoft 365 (read and write)";

    public override string Description => "Reads and writes the user's Microsoft 365: everything the reader does, plus sending email and Teams messages, managing calendar events, files and sharing, To Do and Planner tasks, and OneNote pages.";

    public override string SystemPrompt => M365Prompts.Writer;

    public override IReadOnlyList<ITool> Functions { get; }

    public override ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.ForRoles(UserRole.Admin);
}
