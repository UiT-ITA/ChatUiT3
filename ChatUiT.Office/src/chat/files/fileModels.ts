export interface ChatFile {
  id: string;
  sourceFilename: string;
  chunks: ChatFileChunk[];
}

export interface TextChunk {
  type: "text";
  text: string;
  format: "plain" | "markdown";
}

export interface ImageChunk {
  type: "image";
  base64: string;
  /**
   * Pixel size after normalization, set at import. Needed to price the image in tokens
   * before it is sent. Absent on chunks rebuilt from stored files, where the server has
   * already counted them.
   */
  width?: number;
  height?: number;
}

export type ChatFileChunk = TextChunk | ImageChunk;
