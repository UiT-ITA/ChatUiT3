/* global File */

import type { ChatFile } from "../fileModels";
import { createChatFile, createTextChunk, readFileAsText } from "./processingShared";

export async function processTextImport(file: File, format: "plain" | "markdown"): Promise<ChatFile> {
  const text = await readFileAsText(file);
  return createChatFile(file.name, [createTextChunk(text, format)]);
}
