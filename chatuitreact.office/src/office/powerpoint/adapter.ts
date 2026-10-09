import type { OfficeApp } from "../shared/officeTool";
import { powerPointContext } from "./context";
import { instructions } from "./instructions";
import { powerPointTools } from "./tools";

export const powerPointApp: OfficeApp = {
  name: "PowerPoint",
  minimum: { set: "PowerPointApi", version: "1.4" },
  emptyMessage: "Ask ChatUiT about this presentation.",
  instructions,
  getContext: powerPointContext,
  tools: powerPointTools,
};
