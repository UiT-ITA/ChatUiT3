import { makeStyles } from "@fluentui/react-components";
import { color, radius, typography } from "./tokens";

export interface DevHostBarProps {
  host: string;
  hosts: readonly string[];
  onChange(host: string): void;
}

const useStyles = makeStyles({
  // Left-aligned, so Office's "i" menu in the top-right corner does not cover it.
  root: {
    ...typography.caption,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexShrink: 0,
    padding: "0.375rem 0.875rem",
    borderBottom: `1px solid ${color.line}`,
    backgroundColor: color.panel,
    color: color.text2,
  },
  label: { ...typography.overline, color: color.text3 },
  select: {
    ...typography.captionStrong,
    padding: "0.125rem 0.375rem",
    border: `1px solid ${color.line}`,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    color: color.text,
    cursor: "pointer",
  },
});

/** Development builds only: which ChatUiT server the pane talks to. Switching starts a new chat. */
export function DevHostBar({ host, hosts, onChange }: DevHostBarProps) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <span className={styles.label}>Server</span>
      <select
        className={styles.select}
        value={host}
        onChange={(event) => onChange(event.target.value)}
        aria-label="ChatUiT server"
      >
        {hosts.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
