import type { OfficeApp } from "../shared/officeTool";
import { powerPointContext } from "./context";
import { instructions } from "./instructions";
import { powerPointTools } from "./tools";

export const powerPointApp: OfficeApp = {
  name: "PowerPoint",
  minimum: { set: "PowerPointApi", version: "1.4" },
  emptyMessage: "Ask ChatUiT about this presentation.",
  starters: [
    {
      label: "Review the presentation",
      prompt:
        "Review this presentation for structure, clarity and consistency. List the most important problems first.",
    },
    { label: "Summarize it", prompt: "Summarize this presentation in five bullet points." },
    {
      label: "Tighten this slide",
      prompt: "Shorten the text on the current slide so each point is brief and easy to read.",
    },
  ],
  noDocumentMessage: "Chats are saved once the file has been saved.",
  instructions,
  getContext: powerPointContext,
  tools: powerPointTools,
};
