import type { app } from "@microsoft/teams-js";
import type { HostAdapter } from "../chat/host";

/** The server agent of the meeting side panel. */
const TEAMS_MODEL = "teams";

/** The chat adapter of a Teams meeting. Its saved chats are kept under the meeting chat. */
export function teamsAdapter(context: app.Context): HostAdapter {
  const chatId = context.chat?.id ?? null;
  return {
    logoUrl: "assets/chatuit-logo.svg",
    emptyMessage: "Ask ChatUiT about this meeting.",
    starters: [
      { label: "Summarize the chat", prompt: "Summarize the meeting chat." },
      { label: "Summarize the transcript", prompt: "Summarize the meeting transcript and list the action items." },
      { label: "List who attended", prompt: "List who attended the meeting." },
    ],
    model: TEAMS_MODEL,
    instructions: "",
    tools: [],
    getContext: async () => (chatId ? `Teams meeting.\nMeeting chat id: ${chatId}` : null),
    getDocumentKey: async () => chatId,
    noDocumentMessage: "Chats are saved once the meeting has a chat.",
    getUserName: async () => context.user?.userPrincipalName || undefined,
  };
}
