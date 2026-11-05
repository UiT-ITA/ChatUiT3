import { makeStyles, mergeClasses, Spinner } from "@fluentui/react-components";
import type { ItemActivity } from "../conversation/conversation";
import { Icon } from "./icons";
import { ActivityEntries } from "./Reasoning";
import { color, space, border, icon, typography } from "./tokens";

export type ToolActivityStatus = "running" | "waiting" | "done" | "declined" | "failed";

export interface ToolActivityProps {
  name: string;
  status: ToolActivityStatus;
  /** What the user answered or decided, shown after the name. */
  detail?: string;
  /** Inner calls and reasoning of a server tool that is an agent. */
  activity?: ItemActivity;
}

const STATUS_LABELS: Record<ToolActivityStatus, string> = {
  running: "Running",
  waiting: "Waiting for you",
  done: "Done",
  declined: "Declined",
  failed: "Failed",
};

const useStyles = makeStyles({
  line: {
    ...typography.uiPlain,
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: space.sm,
    minWidth: 0,
  },
  running: { color: color.text2 },
  waiting: { color: color.text2 },
  done: { color: color.text3 },
  declined: { color: color.text3 },
  failed: { color: color.danger },
  icon: { display: "flex", flexShrink: 0, width: icon.sm, justifyContent: "center" },
  doneIcon: { color: color.success },
  waitingIcon: { color: color.warn },
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  detail: { ...typography.caption, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  hidden: { position: "absolute", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" },
  body: {
    margin: `${space.xs} 0 0 ${space.sm}`,
    padding: `0 0 0 ${space.lg}`,
    borderLeft: `${border.md} solid ${color.line}`,
  },
});

/**
 * A tool call: one line with its status and name, and what the user decided when it waited for
 * them. A server agent's inner activity is listed underneath.
 */
export function ToolActivity({ name, status, detail, activity }: ToolActivityProps) {
  const styles = useStyles();
  return (
    <div>
      <div className={mergeClasses(styles.line, styles[status])}>
        <span
          className={mergeClasses(
            styles.icon,
            status === "done" && styles.doneIcon,
            status === "waiting" && styles.waitingIcon
          )}
        >
          {status === "running" ? (
            <Spinner size="extra-tiny" />
          ) : (
            <Icon name={status === "done" ? "check" : status === "waiting" ? "history" : "failed"} />
          )}
        </span>
        <span className={styles.name}>{name}</span>
        {detail ? (
          <span className={styles.detail}>· {detail}</span>
        ) : (
          <span className={styles.hidden}>{STATUS_LABELS[status]}</span>
        )}
      </div>
      {activity && (
        <div className={styles.body}>
          <ActivityEntries activity={activity} />
        </div>
      )}
    </div>
  );
}
