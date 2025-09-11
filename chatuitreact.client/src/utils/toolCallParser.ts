export type ParsedSegment =
  | { type: 'text'; text: string }
  | {
      type: 'toolcall';
      functionLine: string;
      functionName?: string;
      argsText?: string;
      resultText?: string;
      raw: string;
      isComplete: boolean;
    };

/**
 * Splits the input into plain text and <ToolCall> segments.
 * Supports incomplete (streaming) toolcall blocks (no closing tag yet).
 */
export function segmentToolCalls(input: string | undefined | null): ParsedSegment[] {
  const text = input ?? "";
  const segments: ParsedSegment[] = [];
  const startTag = "<ToolCall>";
  const endTag = "</ToolCall>";

  let pos = 0;

  while (true) {
    const start = text.indexOf(startTag, pos);
    if (start === -1) {
      const tail = text.slice(pos);
      if (tail) segments.push({ type: "text", text: tail });
      break;
    }

    const before = text.slice(pos, start);
    if (before) segments.push({ type: "text", text: before });

    const contentStart = start + startTag.length;
    const end = text.indexOf(endTag, contentStart);

    if (end === -1) {
      // Incomplete (streaming) toolcall - take everything to the end
      const inner = text.slice(contentStart);
      segments.push(parseToolCall(inner, false));
      break; // nothing more to parse until more content arrives
    } else {
      // Complete toolcall
      const inner = text.slice(contentStart, end);
      segments.push(parseToolCall(inner, true));
      pos = end + endTag.length;
    }
  }

  return segments;
}

function parseToolCall(inner: string, isComplete: boolean): ParsedSegment {
  const raw = inner;
  const trimmed = inner.replace(/^\s+|\s+$/g, ""); // trim but keep original raw

  const lines = trimmed.split(/\r?\n/);
  const firstContentIdx = lines.findIndex((l) => l.trim().length > 0);

  const functionLine = firstContentIdx >= 0 ? lines[firstContentIdx].trim() : "";

  let functionName: string | undefined;
  let argsText: string | undefined;

  // Extract function name and args from "fnName({...})"
  const m = /^([a-zA-Z0-9_]+)\((.*)\)$/.exec(functionLine);
  if (m) {
    functionName = m[1];
    argsText = m[2];
  }

  const resultText =
    firstContentIdx >= 0 && firstContentIdx + 1 < lines.length
      ? lines.slice(firstContentIdx + 1).join("\n").replace(/^\s+/, "")
      : undefined;

  return {
    type: "toolcall",
    functionLine,
    functionName,
    argsText,
    resultText,
    raw,
    isComplete,
  };
}
