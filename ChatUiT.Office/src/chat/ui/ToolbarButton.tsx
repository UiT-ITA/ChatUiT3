/* global HTMLButtonElement */

import { makeStyles, mergeClasses } from "@fluentui/react-components";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./icons";
import { color, radius } from "./tokens";

export interface ToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** The accessible name, and the tooltip unless `title` is set. */
  label: string;
  /** Shown as pressed, for example while the button's menu is open. */
  active?: boolean;
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
    border: "none",
    borderRadius: radius.md,
    backgroundColor: "transparent",
    color: color.text2,
    cursor: "pointer",
    ":hover:enabled": { backgroundColor: color.panel, color: color.text },
    ":disabled": { opacity: 0.5, cursor: "default" },
  },
  active: { backgroundColor: color.panel, color: color.text },
});

/** A borderless icon button, for the header and the composer. Takes a ref and props, so it can open a menu. */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { icon, label, active, title, className, ...props },
  ref
) {
  const styles = useStyles();
  return (
    <button
      ref={ref}
      type="button"
      className={mergeClasses(styles.root, active && styles.active, className)}
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      <Icon name={icon} size={1.0625} />
    </button>
  );
});
