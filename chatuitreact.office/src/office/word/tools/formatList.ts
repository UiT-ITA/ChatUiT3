/* global Word */

import {
  optionalInteger,
  optionalOneOf,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadParagraphSpan, runWord } from "./shared";

const ACTIONS = ["setLevel", "restart", "startNew", "setLevelFormat", "detach"] as const;
const BULLETS = ["Solid", "Hollow", "Square", "Diamonds", "Arrow", "Checkmark"] as const;
const NUMBERINGS = ["Arabic", "UpperRoman", "LowerRoman", "UpperLetter", "LowerLetter"] as const;

interface LevelFormat {
  level: number;
  bullet?: (typeof BULLETS)[number];
  numbering?: (typeof NUMBERINGS)[number];
  numberFormat?: Array<string | number>;
  startAt?: number;
}

export const formatList: OfficeToolDefinition = {
  name: "word_format_list",
  description:
    "Change lists on the paragraphs from fromId to toId (inclusive). setLevel: set the level (0 to 8) of the list " +
    "items. restart: restart the numbering at the first paragraph. startNew: make the paragraphs a new list, " +
    "optionally with a level format. setLevelFormat: set the bullet or numbering of a level of the first " +
    `paragraph's list, and its starting number. detach: take the paragraphs out of their list.`,
  requires: { set: "WordApiDesktop", version: "1.4" },
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      fromId: { type: "string" },
      toId: { type: "string" },
      level: {
        type: "integer",
        minimum: 0,
        maximum: 8,
        description: "For setLevel, setLevelFormat and startNew. Default 0.",
      },
      bullet: { type: "string", enum: [...BULLETS] },
      numbering: { type: "string", enum: [...NUMBERINGS] },
      numberFormat: {
        type: "array",
        items: { type: ["string", "integer"] },
        description:
          'With numbering: the number text, where an integer is the level whose number is shown. [0, "."] gives "1." ' +
          'and [0, ".", 1] gives "1.1".',
      },
      startAt: { type: "integer", minimum: 0, description: "The starting number of the level." },
    },
    required: ["action", "fromId", "toId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const fromId = requireString(args, "fromId");
    const toId = requireString(args, "toId");
    const format = readLevelFormat(args);
    if (action === "setLevel" && optionalInteger(args, "level") === undefined) {
      throw new ToolArgumentError(`"level" is required for setLevel.`);
    }
    if (action === "setLevelFormat" && !format.bullet && !format.numbering && format.startAt === undefined) {
      throw new ToolArgumentError(`Give "bullet", "numbering" or "startAt" for setLevelFormat.`);
    }

    return runWord(signal, async (context) => {
      const span = await loadParagraphSpan(context, fromId, toId);
      span.forEach((paragraph) => paragraph.load("isListItem"));
      await context.sync();
      const items = span.filter((paragraph) => paragraph.isListItem);

      switch (action) {
        case "setLevel":
          items.forEach((paragraph) => {
            paragraph.listItem.level = format.level;
          });
          break;
        case "restart":
          requireListItem(span[0]);
          span[0].separateList();
          break;
        case "detach":
          items.forEach((paragraph) => paragraph.detachFromList());
          break;
        case "startNew": {
          items.forEach((paragraph) => paragraph.detachFromList());
          const list = span[0].startNewList();
          list.load("id");
          await context.sync();
          span.slice(1).forEach((paragraph) => paragraph.attachToList(list.id, 0));
          applyLevelFormat(list, format);
          break;
        }
        case "setLevelFormat":
          requireListItem(span[0]);
          applyLevelFormat(span[0].list, format);
          break;
      }
      await context.sync();
      return { paragraphs: span.length, listItems: action === "startNew" ? span.length : items.length };
    });
  },
};

function readLevelFormat(args: ToolArguments): LevelFormat {
  const bullet = optionalOneOf(args, "bullet", BULLETS);
  const numbering = optionalOneOf(args, "numbering", NUMBERINGS);
  if (bullet && numbering) {
    throw new ToolArgumentError(`Give "bullet" or "numbering", not both.`);
  }
  const numberFormat = args.numberFormat;
  if (
    numberFormat !== undefined &&
    (!Array.isArray(numberFormat) ||
      numberFormat.some((part) => typeof part !== "string" && !(Number.isInteger(part) && part >= 0 && part <= 8)))
  ) {
    throw new ToolArgumentError(`"numberFormat" must be an array of strings and level numbers from 0 to 8.`);
  }
  if (numberFormat !== undefined && !numbering) {
    throw new ToolArgumentError(`"numberFormat" needs "numbering".`);
  }
  const level = optionalInteger(args, "level") ?? 0;
  if (level < 0 || level > 8) {
    throw new ToolArgumentError(`"level" must be an integer from 0 to 8.`);
  }
  return {
    level,
    bullet,
    numbering,
    numberFormat: numberFormat as Array<string | number> | undefined,
    startAt: optionalInteger(args, "startAt"),
  };
}

function requireListItem(paragraph: Word.Paragraph): void {
  if (!paragraph.isListItem) {
    throw new Error("The first paragraph is not in a list.");
  }
}

function applyLevelFormat(list: Word.List, format: LevelFormat): void {
  if (format.bullet) {
    list.setLevelBullet(format.level, format.bullet);
  }
  if (format.numbering) {
    list.setLevelNumbering(format.level, format.numbering, format.numberFormat);
  }
  if (format.startAt !== undefined) {
    list.setLevelStartingNumber(format.level, format.startAt);
  }
}
