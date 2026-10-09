import type { OfficeApp } from "../shared/officeTool";
import { wordContext } from "./context";
import { instructions } from "./instructions";
import { WordSettings } from "./Settings";
import { wordTools } from "./tools";

export const wordApp: OfficeApp = {
  name: "Word",
  minimum: { set: "WordApi", version: "1.6" },
  emptyMessage: "Ask ChatUiT about this document.",
  instructions,
  getContext: wordContext,
  tools: wordTools,
  Settings: WordSettings,
};
