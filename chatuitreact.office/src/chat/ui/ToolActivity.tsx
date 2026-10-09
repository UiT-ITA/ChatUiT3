import { makeStyles, mergeClasses } from "@fluentui/react-components";
import type { ItemActivity } from "../conversation/conversation";
import { ActivityEntries } from "./Reasoning";
import { color, radius, typography } from "./tokens";

export type ToolActivityStatus = "running" | "done" | "failed";

export interface ToolActivityProps {
  name: string;
  status: ToolActivityStatus;
  /** Inner calls and reasoning of a server tool that is an agent. */
  activity?: ItemActivity;
}

const STATUS_LABELS: Record<ToolActivityStatus, string> = {
  running: "Running",
  done: "Done",
  failed: "Failed",
};

const useStyles = makeStyles({
  root: {
    border: `1px solid ${color.line}`,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  summary: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.375rem 0.625rem",
    backgroundColor: color.panel,
  },
  name: {
    ...typography.overline,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: color.text3,
  },
  status: { ...typography.overline, flexShrink: 0 },
  running: { color: color.warn },
  done: { color: color.success },
  failed: { color: color.danger },
  body: {
    padding: "0.5rem 0.625rem 0.625rem",
    borderTop: `1px solid ${color.line}`,
  },
});

/** A tool call, shown by name with its status. A server agent's inner activity is listed underneath. */
export function ToolActivity({ name, status, activity }: ToolActivityProps) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.summary}>
        <span className={styles.name}>{name}</span>
        <span className={mergeClasses(styles.status, styles[status])}>{STATUS_LABELS[status]}</span>
      </div>
      {activity && (
        <div className={styles.body}>
          <ActivityEntries activity={activity} />
        </div>
      )}
    </div>
  );
}
