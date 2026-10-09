import { makeStyles, mergeClasses } from "@fluentui/react-components";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { color, radius, typography } from "./tokens";

const ASSISTANT_NAME = "ChatUiT";

const useStyles = makeStyles({
  meta: {
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    marginBottom: "0.5rem",
  },
  summary: {
    listStyleType: "none",
    cursor: "pointer",
    userSelect: "none",
    "&::-webkit-details-marker": { display: "none" },
  },
  name: { ...typography.overline, color: color.text2 },
  headline: {
    ...typography.caption,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    minWidth: 0,
    padding: "0.125rem 0.5rem",
    borderRadius: radius.sm,
    color: color.text2,
    ":hover": { color: color.text, backgroundColor: color.panel },
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    margin: "-0.125rem 0 0.5rem 0.5rem",
    padding: "0.25rem 0 0.25rem 0.75rem",
    borderLeft: `2px solid ${color.line}`,
  },
});

export interface TurnActivity {
  seconds: number;
  /** The turn's reasoning and tool activity, in order. */
  children: ReactNode;
}

/**
 * The assistant's meta row: its name, and for a finished turn "Worked for <N>s", which opens the
 * turn's reasoning and tool activity underneath.
 */
export function AssistantMeta({ activity }: { activity?: TurnActivity }) {
  const styles = useStyles();
  if (!activity) {
    return (
      <div className={styles.meta}>
        <span className={styles.name}>{ASSISTANT_NAME}</span>
      </div>
    );
  }
  return (
    <details>
      <summary className={mergeClasses(styles.meta, styles.summary)}>
        <span className={styles.name}>{ASSISTANT_NAME}</span>
        <span className={styles.headline}>
          <Icon name="branch" size={0.9} />
          Worked for {activity.seconds}s
        </span>
      </summary>
      <div className={styles.body}>{activity.children}</div>
    </details>
  );
}
