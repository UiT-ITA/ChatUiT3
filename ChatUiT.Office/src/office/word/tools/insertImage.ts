/* global Word */

import { optionalOneOf, optionalPositiveNumber, optionalString } from "../../../chat/tools/args";
import { imageSourceProperties, readImageSource } from "../../shared/image";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { insertAtLocation, locationProperties, readInsertLocation, runWord } from "./shared";

const WRAPS = ["inline", "square", "tight", "through", "topBottom", "behind", "front"] as const;
const FLOATING_WRAPS: Record<Exclude<(typeof WRAPS)[number], "inline">, Word.ShapeTextWrap["type"]> = {
  square: "Square",
  tight: "Tight",
  through: "Through",
  topBottom: "TopBottom",
  behind: "Behind",
  front: "Front",
};

export const insertImage: OfficeToolDefinition = {
  name: "word_insert_image",
  description:
    "Insert a picture from Base64 data or from an http(s) URL, which the add-in downloads. Inline by default, or " +
    "floating with a text wrap; a floating picture is anchored to the paragraph at the location. Size in points " +
    `keeps the aspect ratio when only width or height is given.`,
  requires: { set: "WordApiDesktop", version: "1.2" },
  parameters: {
    type: "object",
    properties: {
      ...locationProperties,
      ...imageSourceProperties,
      width: { type: "number", exclusiveMinimum: 0 },
      height: { type: "number", exclusiveMinimum: 0 },
      altText: { type: "string" },
      wrap: { type: "string", enum: [...WRAPS], description: "Default inline." },
    },
    required: ["location"],
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const location = readInsertLocation(args);
    const width = optionalPositiveNumber(args, "width");
    const height = optionalPositiveNumber(args, "height");
    const altText = optionalString(args, "altText");
    const wrap = optionalOneOf(args, "wrap", WRAPS) ?? "inline";
    const image = await readImageSource(args, signal);

    const paragraph = await runWord(signal, (context) =>
      insertAtLocation(context, location, (range) => {
        let picture: Word.InlinePicture | Word.Shape;
        if (wrap === "inline") {
          picture = range.insertInlinePictureFromBase64(image, "Replace");
        } else {
          const shape = range.insertPictureFromBase64(image);
          shape.textWrap.type = FLOATING_WRAPS[wrap];
          picture = shape;
        }
        if ((width === undefined) !== (height === undefined)) {
          picture.lockAspectRatio = true;
        }
        if (width !== undefined) {
          picture.width = width;
        }
        if (height !== undefined) {
          picture.height = height;
        }
        if (altText !== undefined) {
          picture.altTextDescription = altText;
        }
        return range.paragraphs.getFirst().load("uniqueLocalId");
      })
    );
    return { paragraphId: paragraph.uniqueLocalId, wrap };
  },
};
