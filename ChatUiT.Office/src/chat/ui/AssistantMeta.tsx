import { makeStyles, mergeClasses } from "@fluentui/react-components";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { color, space, border, dur, typography } from "./tokens";

const useStyles = makeStyles({
  summary: {
    ...typography.caption,
    display: "inline-flex",
    alignItems: "center",
    gap: space.xs,
    marginBottom: space.sm,
    padding: `${space.xs} 0`,
    listStyleType: "none",
    cursor: "pointer",
    userSelect: "none",
    color: color.text3,
    ":hover": { color: color.text },
    "&::-webkit-details-marker": { display: "none" },
  },
  chevron: { display: "flex", transitionProperty: "transform", transitionDuration: dur.fast },
  open: { transform: "rotate(90deg)" },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    margin: `0 0 ${space.md} ${space.xs}`,
    padding: `${space.xs} 0 ${space.xs} ${space.md}`,
    borderLeft: `${border.md} solid ${color.line}`,
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
          <Icon name="chevron" />
        </span>
      </summary>
      <div className={styles.body}>{activity.children}</div>
    </details>
  );
}
