/* global File */

import type { ChatFile } from "../fileModels";
import { createChatFile, normalizeImageFileToChunk } from "./processingShared";

export async function processImageImport(file: File): Promise<ChatFile> {
  const chunk = await normalizeImageFileToChunk(file);
  return createChatFile(file.name, chunk ? [chunk] : []);
}
