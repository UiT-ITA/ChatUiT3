import { marked, type Token, type Tokens } from "marked";

/** Converts Markdown to HTML for an HTML mail body. */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, gfm: true });
}

/** Converts Markdown to plain text for a plain-text mail body: the markup is dropped and links keep their address. */
export function markdownToText(markdown: string): string {
  return blocksText(marked.lexer(markdown, { gfm: true }));
}

function blocksText(tokens: Token[]): string {
  return tokens
    .map(blockText)
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function blockText(token: Token): string {
  switch (token.type) {
    case "space":
    case "def":
    case "checkbox":
      return "";
    case "code":
      return (token as Tokens.Code).text;
    case "hr":
      return "----------";
    case "blockquote":
      return prefixLines(blocksText((token as Tokens.Blockquote).tokens), "> ", "> ");
    case "list": {
      const list = token as Tokens.List;
      const start = typeof list.start === "number" ? list.start : 1;
      return list.items
        .map((item, index) => {
          const marker = list.ordered ? `${start + index}. ` : "- ";
          const task = item.task ? (item.checked ? "[x] " : "[ ] ") : "";
          const content = item.tokens.map(blockText).filter((text) => text.length > 0);
          return prefixLines(task + content.join("\n"), marker, " ".repeat(marker.length));
        })
        .join("\n");
    }
    case "table": {
      const table = token as Tokens.Table;
      return [table.header, ...table.rows]
        .map((row) => row.map((cell) => inlineText(cell.tokens)).join(" | "))
        .join("\n");
    }
    case "html":
      return stripTags((token as Tokens.HTML).text).trim();
    default: {
      const nested = (token as { tokens?: Token[] }).tokens;
      if (nested) {
        return inlineText(nested);
      }
      const text = (token as { text?: unknown }).text;
      return typeof text === "string" ? text : token.raw.trim();
    }
  }
}

function inlineText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case "br":
          return "\n";
        case "image":
          return (token as Tokens.Image).text;
        case "html":
          return /^<br\s*\/?>$/i.test((token as Tokens.Tag).text.trim()) ? "\n" : "";
        case "link": {
          const link = token as Tokens.Link;
          const text = inlineText(link.tokens);
          return text === link.href || link.href.startsWith("#") ? text : `${text} (${link.href})`;
        }
        default: {
          const nested = (token as { tokens?: Token[] }).tokens;
          if (nested) {
            return inlineText(nested);
          }
          const text = (token as { text?: unknown }).text;
          return typeof text === "string" ? text : token.raw;
        }
      }
    })
    .join("");
}

function prefixLines(text: string, first: string, rest: string): string {
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? first : rest) + line)
    .join("\n");
}

function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
}
