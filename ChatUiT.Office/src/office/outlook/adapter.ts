import type { OfficeApp } from "../shared/officeTool";
import { outlookContext } from "./context";
import { instructions } from "./instructions";
import { outlookTools } from "./tools";

export const outlookApp: OfficeApp = {
  name: "Outlook",
  minimum: { set: "Mailbox", version: "1.5" },
  emptyMessage: "Ask ChatUiT about this email.",
  starters: [
    { label: "Summarize the thread", prompt: "Summarize this email thread and list any action items for me." },
    { label: "Draft a reply", prompt: "Draft a polite reply to this email." },
    { label: "Find dates and deadlines", prompt: "List the dates, deadlines and meetings mentioned in this email." },
  ],
  noDocumentMessage: "Chats are saved once the email is part of a thread.",
  instructions,
  getContext: outlookContext,
  tools: outlookTools,
};
