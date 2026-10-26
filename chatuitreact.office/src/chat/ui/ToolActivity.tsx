import { makeStyles, mergeClasses, Spinner } from "@fluentui/react-components";
import type { ItemActivity } from "../conversation/conversation";
import { Icon } from "./icons";
import { ActivityEntries } from "./Reasoning";
import { color, typography } from "./tokens";

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
  line: {
    ...typography.uiPlain,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    minWidth: 0,
  },
  running: { color: color.text2 },
  done: { color: color.text3 },
  failed: { color: color.danger },
  icon: { display: "flex", flexShrink: 0, width: "0.875rem", justifyContent: "center" },
  doneIcon: { color: color.success },
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  hidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
  body: { margin: "0.25rem 0 0 0.375rem", padding: "0 0 0 0.875rem", borderLeft: `2px solid ${color.line}` },
});

/** A tool call: one line with its status and name. A server agent's inner activity is listed underneath. */
export function ToolActivity({ name, status, activity }: ToolActivityProps) {
  const styles = useStyles();
  return (
    <div>
      <div className={mergeClasses(styles.line, styles[status])}>
        <span className={mergeClasses(styles.icon, status === "done" && styles.doneIcon)}>
          {status === "running" ? (
            <Spinner size="extra-tiny" />
          ) : (
            <Icon name={status === "done" ? "check" : "failed"} size={0.875} />
          )}
        </span>
        <span className={styles.name}>{name}</span>
        <span className={styles.hidden}>{STATUS_LABELS[status]}</span>
      </div>
      {activity && (
        <div className={styles.body}>
          <ActivityEntries activity={activity} />
        </div>
      )}
    </div>
  );
}
