import { makeStyles } from "@fluentui/react-components";
import type { ReactNode } from "react";
import type { ItemActivity } from "../conversation/conversation";
import { renderMarkdown } from "./Message";
import { color, typography } from "./tokens";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  title: { ...typography.captionStrong, cursor: "pointer", color: color.text2 },
  text: {
    ...typography.caption,
    lineHeight: 1.55,
    color: color.text2,
    overflowWrap: "anywhere",
    padding: "0.25rem 0 0.25rem 0.75rem",
    "& p": { marginTop: 0, marginBottom: "0.5rem" },
    "& > :last-child": { marginBottom: 0 },
  },
  call: { ...typography.meta, color: color.text3 },
});

/** A top-level reasoning item: one title line per summary part. */
export function Reasoning({ activity }: { activity: ItemActivity }) {
  return <ActivityEntries activity={activity} />;
}

/**
 * Summary parts as title lines, and inner calls as "Calling <name>" lines, in the order they
 * arrived. A title expands to the part's full text.
 */
export function ActivityEntries({ activity }: { activity: ItemActivity }) {
  const styles = useStyles();
  const nodes: ReactNode[] = [];

  activity.entries.forEach((entry, index) => {
    if (entry.kind === "call") {
      nodes.push(
        <span key={index} className={styles.call}>
          Calling {entry.name}
        </span>
      );
      return;
    }
    const text = activity.summaries[entry.index] ?? "";
    const title = summaryTitle(text);
    const body = summaryBody(text);
    if (title && body) {
      nodes.push(
        <details key={index}>
          <summary className={styles.title}>{title}</summary>
          <div className={styles.text} dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
        </details>
      );
    } else if (title) {
      nodes.push(
        <span key={index} className={styles.title}>
          {title}
        </span>
      );
    }
  });

  return nodes.length > 0 ? <div className={styles.list}>{nodes}</div> : null;
}

/** True when the activity has anything to show. */
export function hasActivity(activity: ItemActivity | undefined): boolean {
  return (
    !!activity &&
    activity.entries.some(
      (entry) => entry.kind === "call" || summaryTitle(activity.summaries[entry.index] ?? "") !== ""
    )
  );
}

/**
 * The title of a summary part: its leading bold text (`**Title**`), or its first line when it has
 * none. A bold title that is still streaming is shown as far as it has arrived.
 */
export function summaryTitle(text: string): string {
  const trimmed = text.trimStart();
  const bold = /^\*\*([\s\S]+?)\*\*/.exec(trimmed);
  if (bold) {
    return bold[1].trim();
  }
  const firstLine = trimmed.split("\n")[0];
  return (firstLine.startsWith("**") ? firstLine.replace(/^\*+|\*+$/g, "") : firstLine).trim();
}

/** The text of a summary part without its title, which is already shown on the line that expands it. */
function summaryBody(text: string): string {
  const trimmed = text.trimStart();
  const bold = /^\*\*[\s\S]+?\*\*/.exec(trimmed);
  const rest = bold ? trimmed.slice(bold[0].length) : trimmed.slice(trimmed.split("\n")[0].length);
  return rest.trim();
}
