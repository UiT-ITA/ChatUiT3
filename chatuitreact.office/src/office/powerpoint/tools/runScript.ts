/* global PowerPoint */

import { createRunScriptTool } from "../../shared/runScriptTool";
import { runPowerPoint } from "./shared";

export const runScript = createRunScriptTool<PowerPoint.RequestContext>({
  name: "powerpoint_run_script",
  description:
    "Run Office.js code in PowerPoint, with the whole PowerPoint JavaScript API: for many changes in one call, and " +
    "for anything the other functions cannot do. code is the body of `async (context, PowerPoint) => { ... }` and " +
    "runs inside PowerPoint.run. Return a JSON-serialisable value. Slide ids from the other functions work with " +
    "context.presentation.slides.getItem, and shape ids with that slide's shapes.getItem. Nothing is rolled back " +
    "when the code fails: changes queued before the failing sync stay, so delete slides or shapes after the code " +
    "that may fail. Errors include PowerPoint's failing call and statement.",
  apiName: "PowerPoint",
  api: () => PowerPoint,
  run: runPowerPoint,
});
