/* global window */

import { makeStyles, MenuItem, mergeClasses } from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import { color, space, radius, dur, icon } from "../../chat/ui/tokens";
import { getTrackChangesMode, setTrackChanges, type TrackChangesMode } from "./trackChanges";

const useStyles = makeStyles({
  switch: {
    position: "relative",
    display: "block",
    width: space["2xl"],
    height: icon.sm,
    borderRadius: radius.pill,
    backgroundColor: color.line,
  },
  on: { backgroundColor: color.btnBg },
  knob: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: space.xs,
    width: space.md,
    height: space.md,
    marginTop: "auto",
    marginBottom: "auto",
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    transitionProperty: "left",
    transitionDuration: dur.fast,
  },
  knobOn: { left: space.lg, backgroundColor: color.btnFg },
});

/** The Track Changes switch in the pane's menu, which reflects and changes Word's own setting. */
export function TrackChangesMenuItem() {
  const styles = useStyles();
  const [mode, setMode] = useState<TrackChangesMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getTrackChangesMode().then(
      (current) => {
        setMode(current);
        setError(null);
      },
      (reason: unknown) => setError(String(reason))
    );
  }, []);

  useEffect(() => {
    refresh();
    // The user can also change the setting on Word's Review tab.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const onChange = async (checked: boolean) => {
    try {
      await setTrackChanges(checked);
    } catch (reason) {
      setError(String(reason));
    }
    refresh();
  };

  const on = mode !== null && mode !== "Off";
  return (
    <MenuItem
      role="menuitemcheckbox"
      aria-checked={on}
      persistOnClick
      disabled={mode === null}
      title={error ?? undefined}
      onClick={() => void onChange(!on)}
      secondaryContent={
        <span className={mergeClasses(styles.switch, on && styles.on)} aria-hidden="true">
          <span className={mergeClasses(styles.knob, on && styles.knobOn)} />
        </span>
      }
    >
      Track changes
    </MenuItem>
  );
}
