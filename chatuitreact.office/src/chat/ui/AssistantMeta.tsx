import { makeStyles, mergeClasses } from "@fluentui/react-components";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { color, typography } from "./tokens";

const useStyles = makeStyles({
  summary: {
    ...typography.caption,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    marginBottom: "0.5rem",
    padding: "0.125rem 0",
    listStyleType: "none",
    cursor: "pointer",
    userSelect: "none",
    color: color.text3,
    ":hover": { color: color.text },
    "&::-webkit-details-marker": { display: "none" },
  },
  chevron: {
    display: "flex",
    transitionProperty: "transform",
    transitionDuration: "120ms",
  },
  open: { transform: "rotate(90deg)" },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    margin: "0 0 0.75rem 0.25rem",
    padding: "0.125rem 0 0.125rem 0.75rem",
    borderLeft: `2px solid ${color.line}`,
  },
});

export interface TurnActivity {
  seconds: number;
  /** The turn's reasoning and tool activity, in order. */
  children: ReactNode;
}

/** "Worked for <N>s" above a finished turn's reply, which opens the turn's reasoning and tool activity underneath. */
export function AssistantMeta({ activity }: { activity: TurnActivity }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.summary}>
        Worked for {activity.seconds}s
        <span className={mergeClasses(styles.chevron, open && styles.open)}>
          <Icon name="chevron" size={0.75} />
        </span>
      </summary>
      <div className={styles.body}>{activity.children}</div>
    </details>
  );
}
