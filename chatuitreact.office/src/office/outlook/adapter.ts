import type { OfficeApp } from "../shared/officeTool";
import { outlookContext } from "./context";
import { instructions } from "./instructions";
import { outlookTools } from "./tools";

export const outlookApp: OfficeApp = {
  name: "Outlook",
  minimum: { set: "Mailbox", version: "1.5" },
  emptyMessage: "Ask ChatUiT about this email.",
  instructions,
  getContext: outlookContext,
  tools: outlookTools,
};
