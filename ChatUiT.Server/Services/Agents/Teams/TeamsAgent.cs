using System;
using System.Collections.Generic;
using System.Linq;
using ChatUiT.Server.Services.Agents.M365;
using ChatUiT.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUiT.Server.Services.Agents.Teams;

/// <summary>
/// The assistant of the Teams meeting side panel. The side panel sends the meeting's chat id with
/// every message; this agent adds the functions of the Microsoft 365 read toolboxes on the server.
/// </summary>
public sealed class TeamsAgent : InternalAgent
{
    public TeamsAgent(IServiceProvider services)
    {
        Functions = M365Toolboxes.ReadFunctionTypes.Select(t => (ITool)services.GetRequiredService(t))
            .Append(services.GetRequiredService<GetWebsiteTool>())
            .ToList();
    }

    public override string Id => "teams";

    public override string DisplayName => "Teams";

    public override string Description => "Assistant for the Teams meeting side panel: reads the meeting's chat, transcript and attendance, and the user's Microsoft 365.";

    public override string SystemPrompt => Prompt;

    public override IReadOnlyList<ITool> Functions { get; }

    public override int MaxRounds => 50;

    private const string Prompt = """
        You are an assistant in the side panel of a Microsoft Teams meeting, working for the signed-in user.

        The meeting:
        - The newest user message ends with the meeting context: the meeting chat id, read when the user sent it. "This meeting", "the chat" and "the transcript" mean this meeting unless the user names another.
        - Read the meeting chat with get_chat_messages, the transcript with get_meeting_transcript and attendance with get_meeting_attendance, each with the chat id. A transcript only exists after it was recorded, and usually only the organizer can read it.

        Doing the work:
        - The user's words are the specification. Do every part of what they ask.
        - Ask only when you cannot tell what they mean. Otherwise work through to the end.
        - Then reply briefly.

        When a function fails:
        - Tell the user the function, what you asked it to do and the exact error. Describe as done only what function results show.

        Microsoft 365:
        - Read the user's calendar, meetings, free/busy, people, presence, mail, Teams chats, OneDrive/SharePoint files, tasks and OneNote with the Microsoft 365 functions. Report only what they return.
        - These functions only read. You cannot send messages, create meetings or change anything.

        Answer in the language the user writes in.
        """;
}
