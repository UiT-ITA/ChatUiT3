/** Text that is a JSON object or array, indented; any other text as it is. Undefined for no text. */
export function prettyMaybeJson(text: string | null): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}
