import { optionalString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runWord } from "./shared";

const PROPERTIES = ["title", "subject", "author", "keywords", "comments", "category"] as const;

export const documentProperties: OfficeToolDefinition = {
  name: "word_document_properties",
  description:
    "Read the document properties title, subject, author, keywords, comments and category, and set the given ones. " +
    "Returns the properties after the change.",
  parameters: {
    type: "object",
    properties: Object.fromEntries(PROPERTIES.map((name) => [name, { type: "string" }])),
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const changes = PROPERTIES.flatMap((name) => {
      const value = optionalString(args, name);
      return value === undefined ? [] : [[name, value] as const];
    });

    return runWord(signal, async (context) => {
      const properties = context.document.properties;
      for (const [name, value] of changes) {
        properties[name] = value;
      }
      properties.load(PROPERTIES.join(","));
      await context.sync();
      return Object.fromEntries(PROPERTIES.map((name) => [name, properties[name]]));
    });
  },
};
