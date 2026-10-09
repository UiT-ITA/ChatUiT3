import { optionalString, requireOneOf } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { insertAtLocation, locationProperties, readInsertLocation, runWord } from "./shared";

const ACTIONS = ["insert", "updateAll"] as const;

/** Values of Word.FieldType that can be inserted. */
const FIELD_TYPES = [
  "Addin",
  "AddressBlock",
  "Advance",
  "Ask",
  "Author",
  "AutoText",
  "AutoTextList",
  "BarCode",
  "Bibliography",
  "BidiOutline",
  "Citation",
  "Comments",
  "Compare",
  "CreateDate",
  "Data",
  "Database",
  "Date",
  "DisplayBarcode",
  "DocProperty",
  "DocVariable",
  "EditTime",
  "Embedded",
  "EQ",
  "Expression",
  "FileName",
  "FileSize",
  "FillIn",
  "FormCheckbox",
  "FormDropdown",
  "FormText",
  "GotoButton",
  "GreetingLine",
  "Hyperlink",
  "If",
  "Import",
  "Include",
  "IncludePicture",
  "IncludeText",
  "Index",
  "Info",
  "Keywords",
  "LastSavedBy",
  "Link",
  "ListNum",
  "MacroButton",
  "MergeBarcode",
  "MergeField",
  "MergeRec",
  "MergeSeq",
  "Next",
  "NextIf",
  "NoteRef",
  "NumChars",
  "NumPages",
  "NumWords",
  "OCX",
  "Page",
  "PageRef",
  "Print",
  "PrintDate",
  "Private",
  "Quote",
  "RD",
  "Ref",
  "RevNum",
  "SaveDate",
  "Section",
  "SectionPages",
  "Seq",
  "Set",
  "Shape",
  "SkipIf",
  "StyleRef",
  "Subject",
  "Subscriber",
  "Symbol",
  "TA",
  "TC",
  "Template",
  "Time",
  "Title",
  "TOA",
  "TOC",
  "UserAddress",
  "UserInitials",
  "UserName",
  "XE",
] as const;

export const fields: OfficeToolDefinition = {
  name: "word_fields",
  description:
    "insert: insert a field (TOC, Page, NumPages, Date, Ref, Seq and others) with its arguments and switches in " +
    'code, such as \\o "1-3" \\h \\z \\u for a TOC or a bookmark name for Ref. updateAll: update every field in the ' +
    `document body, for example after headings change.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      ...locationProperties,
      type: { type: "string", enum: [...FIELD_TYPES] },
      code: { type: "string", description: "The field's arguments and switches, without the field name." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    if (action === "updateAll") {
      return runWord(signal, async (context) => {
        const all = context.document.body.fields;
        all.load("items");
        await context.sync();
        all.items.forEach((field) => field.updateResult());
        await context.sync();
        return { updatedFields: all.items.length };
      });
    }
    const location = readInsertLocation(args);
    const type = requireOneOf(args, "type", FIELD_TYPES);
    const code = optionalString(args, "code");

    return runWord(signal, async (context) => {
      const field = await insertAtLocation(context, location, (range) => {
        const inserted = range.insertField("Replace", type, code);
        inserted.load("code");
        inserted.result.load("text");
        return inserted;
      });
      return { code: field.code, result: field.result.text };
    });
  },
};
