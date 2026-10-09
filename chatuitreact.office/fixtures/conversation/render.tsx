import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConversationState } from "../../src/chat/conversation/conversation";
import { MessageList } from "../../src/chat/ui/MessageList";

/**
 * Renders the message list for a state as an outline of its visible text, one text node per line.
 * Text inside a collapsed `<details>` is indented by two spaces per level. The `<summary>` line
 * that stays visible is marked "▸ " at its parent's level.
 */
export function renderOutline(state: ConversationState): string {
  const markup = renderToStaticMarkup(
    <FluentProvider theme={webLightTheme}>
      <MessageList state={state} emptyMessage="Ask ChatUiT about this document." onAnswer={async () => undefined} />
    </FluentProvider>
  ).replace(/<style[\s\S]*?<\/style>/g, "");

  const lines: string[] = [];
  let depth = 0;
  let inSummary = false;
  for (const token of markup.split(/(<[^>]+>)/)) {
    if (token.startsWith("<")) {
      const tag = /^<\/?([a-zA-Z0-9]+)/.exec(token)?.[1];
      const closing = token.startsWith("</");
      if (tag === "details") {
        depth += closing ? -1 : 1;
      } else if (tag === "summary") {
        inSummary = !closing;
      }
      continue;
    }
    for (const line of decode(token).split("\n")) {
      const text = line.trim();
      if (text) {
        lines.push(`${"  ".repeat(inSummary ? depth - 1 : depth)}${inSummary ? "▸ " : ""}${text}`);
      }
    }
  }
  return lines.join("\n");
}

function decode(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
