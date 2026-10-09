import type { OfficeApp } from "../shared/officeTool";
import { excelContext } from "./context";
import { instructions } from "./instructions";
import { excelTools } from "./tools";

export const excelApp: OfficeApp = {
  name: "Excel",
  minimum: { set: "ExcelApi", version: "1.9" },
  emptyMessage: "Ask ChatUiT about this workbook.",
  instructions,
  getContext: excelContext,
  tools: excelTools,
};
