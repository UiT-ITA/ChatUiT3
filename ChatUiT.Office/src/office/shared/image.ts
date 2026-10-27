/* global AbortSignal, document, fetch, Image */

import { bytesToBase64 } from "../../chat/base64";
import { optionalString, ToolArgumentError } from "../../chat/tools/args";
import type { ToolArguments, ToolImage } from "../../chat/tools/types";

/** The `base64` and `url` arguments of an image tool. */
export const imageSourceProperties = {
  base64: { type: "string", description: "The image file as Base64, with or without a data: prefix." },
  url: { type: "string", description: "An http(s) URL of the image. Give base64 or url." },
};

/** The image of `base64` or `url` as Base64, downloading it from the URL. */
export async function readImageSource(args: ToolArguments, signal: AbortSignal): Promise<string> {
  const base64 = optionalString(args, "base64");
  const url = optionalString(args, "url");
  if (!base64 === !url) {
    throw new ToolArgumentError(`Give either "base64" or "url".`);
  }
  return base64 ? base64.replace(/^data:[^,]*,/, "") : download(url as string, signal);
}

async function download(url: string, signal: AbortSignal): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    throw new ToolArgumentError(`"url" must be an http or https URL.`);
  }
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Downloading the image failed with HTTP ${response.status}.`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    throw new Error(`The URL returned "${type || "unknown content"}", not an image.`);
  }
  return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
}

/** The longest edge of a picture sent to the model. Larger pictures cost tokens and are scaled down by the service anyway. */
export const MAX_IMAGE_EDGE = 1600;

/** A PNG picture for the model, scaled down so its longest edge is at most MAX_IMAGE_EDGE pixels. */
export async function toModelImage(pngBase64: string): Promise<ToolImage> {
  const image = new Image();
  image.src = `data:image/png;base64,${pngBase64}`;
  await image.decode();
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale === 1) {
    return { mediaType: "image/png", base64: pngBase64 };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The picture could not be scaled: no canvas.");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { mediaType: "image/png", base64: canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "") };
}
