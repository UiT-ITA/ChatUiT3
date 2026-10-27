/* global Word */

import {
  optionalBoolean,
  optionalOneOf,
  optionalString,
  requireObjectArray,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import {
  insertAtLocation,
  loadTargetRanges,
  locationProperties,
  readInsertLocation,
  readTarget,
  runWord,
  targetHint,
  targetProperties,
} from "./shared";

const ACTIONS = ["wrap", "insert", "list", "update"] as const;
const TYPES = {
  richText: "RichText",
  plainText: "PlainText",
  checkBox: "CheckBox",
  dropDownList: "DropDownList",
  comboBox: "ComboBox",
  datePicker: "DatePicker",
} as const;
const MAX_TEXT = 200;

interface ControlProperties {
  title?: string;
  tag?: string;
  placeholder?: string;
  cannotDelete?: boolean;
  cannotEdit?: boolean;
  checked?: boolean;
  items?: Array<{ text: string; value?: string }>;
}

export const contentControls: OfficeToolDefinition = {
  name: "word_content_controls",
  description:
    "wrap: put a content control around a target (fromId, toId, optional quote). insert: a new empty control at a " +
    "location. list: every control with its id, type, title, tag, text and paragraph id. update: change the " +
    "control id from list. title, tag, placeholder, locks, checked (check box) and items (drop-down list and " +
    `combo box) apply to wrap, insert and update. ${targetHint}`,
  requires: { set: "WordApiDesktop", version: "1.3" },
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      ...targetProperties,
      ...locationProperties,
      fromId: { type: "string", description: "For wrap, and for insert with location replace." },
      toId: { type: "string", description: "For wrap, and for insert with location replace." },
      type: { type: "string", enum: Object.keys(TYPES), description: "For wrap and insert. Default richText." },
      id: { type: "integer", description: "For update." },
      title: { type: "string" },
      tag: { type: "string" },
      placeholder: { type: "string", description: "Text shown while the control is empty." },
      cannotDelete: { type: "boolean" },
      cannotEdit: { type: "boolean", description: "Locks the contents." },
      checked: { type: "boolean" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { text: { type: "string" }, value: { type: "string" } },
          required: ["text"],
          additionalProperties: false,
        },
        description: "Replaces the choices of a drop-down list or combo box.",
      },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    if (action === "list") {
      return runWord(signal, async (context) => {
        const controls = context.document.body.contentControls;
        controls.load("items/id,items/type,items/title,items/tag,items/text,items/cannotDelete,items/cannotEdit");
        await context.sync();
        const paragraphs = controls.items.map((control) => control.paragraphs.getFirst().load("uniqueLocalId"));
        await context.sync();
        return {
          contentControls: controls.items.map((control, index) => ({
            id: control.id,
            type: control.type,
            title: control.title,
            tag: control.tag,
            text: control.text.length > MAX_TEXT ? `${control.text.slice(0, MAX_TEXT)}…` : control.text,
            cannotDelete: control.cannotDelete,
            cannotEdit: control.cannotEdit,
            paragraphId: paragraphs[index].uniqueLocalId,
          })),
        };
      });
    }

    const properties = readControlProperties(args);
    if (action === "update") {
      const id = args.id;
      if (typeof id !== "number" || !Number.isInteger(id)) {
        throw new ToolArgumentError(`"id" must be an integer.`);
      }
      return runWord(signal, async (context) => {
        const control = context.document.contentControls.getById(id);
        control.load("type");
        await context.sync();
        checkControlProperties(control.type, properties);
        applyControlProperties(control, control.type, properties);
        await context.sync();
        return { id };
      });
    }

    const type = TYPES[optionalOneOf(args, "type", Object.keys(TYPES) as Array<keyof typeof TYPES>) ?? "richText"];
    checkControlProperties(type, properties);
    const target = action === "wrap" ? readTarget(args) : null;
    const location = action === "insert" ? readInsertLocation(args) : null;
    // A rich text control is inserted without a type argument, the form every Word version supports.
    const insert = (range: Word.Range) =>
      type === TYPES.richText ? range.insertContentControl() : range.insertContentControl(type);
    return runWord(signal, async (context) => {
      let controls: Word.ContentControl[] = [];
      if (target) {
        controls = (await loadTargetRanges(context, target)).map(insert);
      } else if (location) {
        controls = [await insertAtLocation(context, location, insert)];
      }
      controls.forEach((control) => {
        applyControlProperties(control, type, properties);
        control.load("id");
      });
      await context.sync();

      // Word has returned ids for controls that are not in the document, so each one is looked up again.
      const found = controls.map((control) => {
        const lookup = context.document.contentControls.getByIdOrNullObject(control.id);
        // eslint-disable-next-line office-addins/no-navigational-load
        lookup.load("isNullObject");
        return lookup;
      });
      await context.sync();
      const missing = controls.filter((_control, index) => found[index].isNullObject).map((control) => control.id);
      if (missing.length > 0) {
        throw new Error(
          `Word returned content control ids ${missing.join(", ")} but the controls are not in the document ` +
            `(type ${type}, ${target ? "wrap" : "insert"}).`
        );
      }
      return { ids: controls.map((control) => control.id) };
    });
  },
};

function readControlProperties(args: ToolArguments): ControlProperties {
  return {
    title: optionalString(args, "title"),
    tag: optionalString(args, "tag"),
    placeholder: optionalString(args, "placeholder"),
    cannotDelete: optionalBoolean(args, "cannotDelete"),
    cannotEdit: optionalBoolean(args, "cannotEdit"),
    checked: optionalBoolean(args, "checked"),
    items:
      args.items === undefined
        ? undefined
        : requireObjectArray(args, "items").map((item) => ({
            text: requireString(item, "text"),
            value: optionalString(item, "value"),
          })),
  };
}

function checkControlProperties(type: string, properties: ControlProperties): void {
  if (properties.checked !== undefined && type !== TYPES.checkBox) {
    throw new ToolArgumentError(`"checked" applies to check box controls only.`);
  }
  if (properties.items && type !== TYPES.comboBox && type !== TYPES.dropDownList) {
    throw new ToolArgumentError(`"items" applies to drop-down list and combo box controls only.`);
  }
}

/** Applies the properties to a control of the type, after checkControlProperties. */
function applyControlProperties(control: Word.ContentControl, type: string, properties: ControlProperties): void {
  const { title, tag, placeholder, cannotDelete, cannotEdit, checked, items } = properties;
  if (title !== undefined) {
    control.title = title;
  }
  if (tag !== undefined) {
    control.tag = tag;
  }
  if (placeholder !== undefined) {
    control.placeholderText = placeholder;
  }
  if (cannotDelete !== undefined) {
    control.cannotDelete = cannotDelete;
  }
  if (cannotEdit !== undefined) {
    control.cannotEdit = cannotEdit;
  }
  if (checked !== undefined) {
    control.checkboxContentControl.isChecked = checked;
  }
  if (items) {
    const list = type === TYPES.comboBox ? control.comboBoxContentControl : control.dropDownListContentControl;
    list.deleteAllListItems();
    items.forEach((item) => list.addListItem(item.text, item.value));
  }
}
