import type { OfficeApp } from "../shared/officeTool";
import { wordContext } from "./context";
import { instructions } from "./instructions";
import { TrackChangesMenuItem } from "./TrackChangesMenuItem";
import { wordTools } from "./tools";

export const wordApp: OfficeApp = {
  name: "Word",
  minimum: { set: "WordApi", version: "1.6" },
  emptyMessage: "Ask ChatUiT about this document.",
  starters: [
    {
      label: "Review the document",
      prompt:
        "Review this document for clarity, structure and language. List the most important problems first, " +
        "with a concrete suggestion for each.",
    },
    { label: "Summarize it", prompt: "Summarize this document in five bullet points." },
    {
      label: "Improve the selected text",
      prompt: "Rewrite the selected text so it is clearer and more concise, without changing its meaning.",
    },
  ],
  noDocumentMessage: "Chats are saved once the file has been saved.",
  instructions,
  getContext: wordContext,
  tools: wordTools,
  MenuItems: TrackChangesMenuItem,
};
