import { optionalOneOf, requireOneOf, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, runExcel } from "./shared";

const ACTIONS = ["insert", "delete"] as const;
const TARGETS = ["cells", "entireRows", "entireColumns"] as const;
const SHIFTS = ["down", "right", "up", "left"] as const;
const INSERT_SHIFT = { down: "Down", right: "Right" } as const;
const DELETE_SHIFT = { up: "Up", left: "Left" } as const;

export const insertDelete: OfficeToolDefinition = {
  name: "excel_insert_delete",
  description:
    "Insert or delete cells, entire rows or entire columns at a range. insert puts blank cells of the range's size " +
    "there and shifts the existing cells down or right; delete removes them and shifts the rest up or left. Entire " +
    "rows always shift down or up, entire columns right or left; cells need shift. Returns the address of the " +
    `inserted cells.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      address: { type: "string", description: "The cells, or any cells in the rows or columns, such as Sheet1!A3:A5." },
      target: { type: "string", enum: [...TARGETS] },
      shift: {
        type: "string",
        enum: [...SHIFTS],
        description: "For cells: down or right to insert, up or left to delete.",
      },
    },
    required: ["action", "address", "target"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const address = requireString(args, "address");
    const target = requireOneOf(args, "target", TARGETS);
    const shift = optionalOneOf(args, "shift", SHIFTS);
    const direction =
      target === "entireRows"
        ? action === "insert"
          ? "down"
          : "up"
        : target === "entireColumns"
          ? action === "insert"
            ? "right"
            : "left"
          : shift;
    if (direction === undefined) {
      throw new ToolArgumentError(`"shift" is required for cells.`);
    }
    const operation = readOperation(action, direction);

    return runExcel(signal, async (context) => {
      const given = getRange(context, address);
      const range =
        target === "entireRows" ? given.getEntireRow() : target === "entireColumns" ? given.getEntireColumn() : given;
      if (operation.action === "insert") {
        const inserted = range.insert(operation.shift).load("address");
        await context.sync();
        return { inserted: inserted.address };
      }
      range.load("address");
      await context.sync();
      const deleted = range.address;
      range.delete(operation.shift);
      await context.sync();
      return { deleted };
    });
  },
};

type Operation =
  | { action: "insert"; shift: (typeof INSERT_SHIFT)[keyof typeof INSERT_SHIFT] }
  | { action: "delete"; shift: (typeof DELETE_SHIFT)[keyof typeof DELETE_SHIFT] };

function readOperation(action: (typeof ACTIONS)[number], direction: (typeof SHIFTS)[number]): Operation {
  if (action === "insert" && (direction === "down" || direction === "right")) {
    return { action, shift: INSERT_SHIFT[direction] };
  }
  if (action === "delete" && (direction === "up" || direction === "left")) {
    return { action, shift: DELETE_SHIFT[direction] };
  }
  throw new ToolArgumentError(`"shift" must be ${action === "insert" ? "down or right" : "up or left"} to ${action}.`);
}
