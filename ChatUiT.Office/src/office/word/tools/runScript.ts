/* global Word */

import { createRunScriptTool } from "../../shared/runScriptTool";
import { runWord } from "./shared";

export const runScript = createRunScriptTool<Word.RequestContext>({
  name: "word_run_script",
  description:
    "Run Office.js code in Word, with the whole Word JavaScript API: for many changes in one call, and for " +
    "anything the other functions cannot do. code is the body of `async (context, Word) => { ... }` and runs " +
    "inside Word.run. Return a JSON-serialisable value. Paragraph ids from the other functions work with " +
    "context.document.getParagraphByUniqueLocalId. Nothing is rolled back when the code fails: changes queued " +
    "before the failing sync stay, so clear or delete content after the code that may fail. Set built-in styles " +
    "with styleBuiltIn (Word.BuiltInStyleName): style takes names in Word's display language. Errors include " +
    "Word's failing call and statement.",
  apiName: "Word",
  api: () => Word,
  run: runWord,
});
