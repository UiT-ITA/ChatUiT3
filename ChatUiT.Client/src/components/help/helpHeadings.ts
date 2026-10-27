export interface HelpHeading {
  /** 1-based line in the markdown source. */
  line: number;
  /** Anchor id, unique within the page. */
  id: string;
  text: string;
  level: 2 | 3;
}

/** Lower-case, letters and digits of any script kept, everything else collapsed to "-". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Every `##` and `###` heading in a help page, in order. Computed from the
 * source text so ids are stable across renders; repeated heading texts get
 * -2, -3 suffixes. Fenced code is skipped.
 */
export function parseHeadings(markdown: string): HelpHeading[] {
  const headings: HelpHeading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  markdown.split('\n').forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = /^(##|###)\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return;
    const text = match[2].replace(/[`*_]/g, '');
    const base = slugify(text) || 'section';
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    headings.push({
      line: index + 1,
      id: count === 1 ? base : `${base}-${count}`,
      text,
      level: match[1].length as 2 | 3,
    });
  });
  return headings;
}
