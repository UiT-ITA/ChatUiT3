/* global window */

import { useCallback, useEffect, useState } from "react";
import { ToolbarButton } from "../../chat/ui/ToolbarButton";
import { getTrackChangesMode, setTrackChanges, type TrackChangesMode } from "./trackChanges";

/** The Track Changes toggle, which reflects and changes Word's own setting. */
export function WordSettings() {
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
    <ToolbarButton
      icon="draft"
      label="Track changes"
      pressed={on}
      disabled={mode === null}
      title={error ?? `Track changes: ${on ? "on" : "off"}`}
      onClick={() => void onChange(!on)}
    />
  );
}
