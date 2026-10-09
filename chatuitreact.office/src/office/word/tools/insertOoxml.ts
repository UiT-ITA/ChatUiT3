import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { toFlatPackage } from "../ooxml";
import { insertAtLocation, locationProperties, readInsertLocation, runWord } from "./shared";

export const insertOoxml: OfficeToolDefinition = {
  name: "word_insert_ooxml",
  description:
    "Insert OOXML for content the other tools cannot make: equations, text boxes, shapes, SmartArt, watermarks, " +
    "exact formatting. Give a full flat OPC package (pkg:package), or body content such as <w:p>, <w:tbl> or " +
    "<m:oMathPara>, which is wrapped in a package (content that is not a paragraph, table or block content control " +
    "goes in a paragraph). The prefixes w, r, m, wp, a, pic, c, dgm, wps, wpg, mc, v, o, w10, w14 and wp14 are " +
    `declared. Content that needs other parts, such as images, needs a full package.`,
  parameters: {
    type: "object",
    properties: {
      ...locationProperties,
      ooxml: { type: "string" },
    },
    required: ["location", "ooxml"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const location = readInsertLocation(args);
    const ooxml = toFlatPackage(requireString(args, "ooxml"));

    return runWord(signal, async (context) => {
      const paragraphs = await insertAtLocation(context, location, (range) =>
        range.insertOoxml(ooxml, "Replace").paragraphs.load("items/uniqueLocalId")
      );
      return { insertedParagraphIds: paragraphs.items.map((paragraph) => paragraph.uniqueLocalId) };
    });
  },
};
