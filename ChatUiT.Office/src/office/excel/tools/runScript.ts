/* global Excel */

import { createRunScriptTool } from "../../shared/runScriptTool";
import { runExcel } from "./shared";

export const runScript = createRunScriptTool<Excel.RequestContext>({
  name: "excel_run_script",
  description:
    "Run Office.js code in Excel, with the whole Excel JavaScript API: for many changes in one call, and for " +
    "anything the other functions cannot do. code is the body of `async (context, Excel) => { ... }` and runs " +
    "inside Excel.run. Return a JSON-serialisable value. Sheet names and addresses from the other functions work " +
    "with context.workbook.worksheets.getItem(name).getRange(address). Nothing is rolled back when the code fails: " +
    "changes queued before the failing sync stay, so clear or delete content after the code that may fail. Errors " +
    "include Excel's failing call and statement.",
  apiName: "Excel",
  api: () => Excel,
  run: runExcel,
});
