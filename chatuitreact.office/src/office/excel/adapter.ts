import type { OfficeApp } from "../shared/officeTool";
import { excelContext } from "./context";
import { instructions } from "./instructions";
import { excelTools } from "./tools";

export const excelApp: OfficeApp = {
  name: "Excel",
  minimum: { set: "ExcelApi", version: "1.9" },
  emptyMessage: "Ask ChatUiT about this workbook.",
  starters: [
    { label: "Explain this sheet", prompt: "Explain what this sheet contains and how it is structured." },
    {
      label: "Check for errors",
      prompt: "Check this sheet for formula errors, inconsistent formulas and values that look wrong.",
    },
    {
      label: "Chart the selection",
      prompt: "Create a chart that shows the most important trend in the selected data.",
    },
  ],
  noDocumentMessage: "Chats are saved once the file has been saved.",
  instructions,
  getContext: excelContext,
  tools: excelTools,
};
