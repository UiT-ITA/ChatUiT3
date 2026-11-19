import { useState } from 'react';

/** Runs one async action at a time. busy is true while it runs, and run does nothing meanwhile. */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run] as const;
}
