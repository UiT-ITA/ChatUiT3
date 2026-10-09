import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { documentBody, partNames } from "../ooxml";
import { loadParagraphSpan, runWord } from "./shared";

const MAX_LENGTH = 60_000;

export const getOoxml: OfficeToolDefinition = {
  name: "word_get_ooxml",
  description:
    "Get the OOXML of the paragraphs from fromId to toId (inclusive): the content of the w:body of the document " +
    `part and the names of the other parts (styles, numbering, media). At most ${MAX_LENGTH} characters; ` +
    `truncated is true when the body was cut. Use it to read exact formatting or to edit with word_insert_ooxml.`,
  parameters: {
    type: "object",
    properties: {
      fromId: { type: "string" },
      toId: { type: "string" },
    },
    required: ["fromId", "toId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const fromId = requireString(args, "fromId");
    const toId = requireString(args, "toId");

    return runWord(signal, async (context) => {
      const span = await loadParagraphSpan(context, fromId, toId);
      const range = span[0].getRange("Whole").expandTo(span[span.length - 1].getRange("Whole"));
      const result = range.getOoxml();
      await context.sync();
      // getOoxml returns a ClientResult, which needs no load; the rule takes it for a proxy object.
      // eslint-disable-next-line office-addins/load-object-before-read
      const ooxml = result.value;
      const body = documentBody(ooxml) ?? "";
      return {
        body: body.slice(0, MAX_LENGTH),
        truncated: body.length > MAX_LENGTH,
        parts: partNames(ooxml).filter((name) => name !== "/word/document.xml"),
      };
    });
  },
};
