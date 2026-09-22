using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Agents.M365.Functions;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>Everything the reader can do, plus sending Teams messages, creating group chats and writing files.</summary>
public sealed class M365WriterAgent : InternalAgent
{
    public M365WriterAgent(
        M365ReaderAgent reader,
        SendChatMessageFunction sendChatMessage,
        CreateGroupChatFunction createGroupChat,
        WriteTextFileFunction writeTextFile)
    {
        Functions = reader.Functions.Concat([sendChatMessage, createGroupChat, writeTextFile]).ToList();
    }

    public override string Id => "m365_writer";

    public override string DisplayName => "Microsoft 365 (read and write)";

    public override string Description => "Reads and writes the user's Microsoft 365: everything the reader does, plus sending Teams messages, creating group chats and writing files to OneDrive.";

    public override string SystemPrompt => M365Prompts.Writer;

    public override IReadOnlyList<ITool> Functions { get; }

    public override ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.ForRoles(UserRole.Admin);
}
