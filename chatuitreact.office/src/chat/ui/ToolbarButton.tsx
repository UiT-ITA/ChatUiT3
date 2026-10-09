import { makeStyles, mergeClasses, shorthands } from "@fluentui/react-components";
import { Icon, type IconName } from "./icons";
import { color, radius } from "./tokens";

export interface ToolbarButtonProps {
  icon: IconName;
  /** The accessible name, and the tooltip unless `title` is set. */
  label: string;
  /** Set for an on/off button. */
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  onClick(): void;
}

const useStyles = makeStyles({
  root: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "2rem",
    height: "2rem",
    padding: 0,
    border: `1px solid ${color.line}`,
    borderRadius: radius.md,
    backgroundColor: "transparent",
    color: color.text2,
    cursor: "pointer",
    ":hover:enabled": { backgroundColor: color.panel, color: color.accent },
    ":disabled": { opacity: 0.5, cursor: "default" },
  },
  pressed: {
    backgroundColor: color.panel2,
    color: color.brand,
    ...shorthands.borderColor(color.brand),
    ":hover:enabled": { backgroundColor: color.panel2, color: color.brand },
  },
});

/** An icon button in the composer toolbar, styled as the app's composer tool buttons. */
export function ToolbarButton({ icon, label, pressed, disabled, title, onClick }: ToolbarButtonProps) {
  const styles = useStyles();
  return (
    <button
      type="button"
      className={mergeClasses(styles.root, pressed && styles.pressed)}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={title ?? label}
      onClick={onClick}
    >
      <Icon name={icon} size={1.0625} />
    </button>
  );
}
