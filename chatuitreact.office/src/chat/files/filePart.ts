import type { FilePart } from "../api/types";
import type { ChatFile } from "./fileModels";

/** At most this many files go with one message, as in ChatUiT's chat. */
export const MAX_FILES = 10;

/** A file the pane read, as the message part the server expects. Images are JPEG, as the readers make them. */
export function toFilePart(file: ChatFile): FilePart {
  return {
    type: "input_file",
    filename: file.sourceFilename,
    chunks: file.chunks.map((chunk) =>
      chunk.type === "text"
        ? { type: "input_text", text: chunk.text }
        : { type: "input_image", image_url: `data:image/jpeg;base64,${chunk.base64}` }
    ),
  };
}
