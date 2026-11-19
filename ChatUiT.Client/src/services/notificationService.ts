import { toast } from "@ui-sdk/react/toast";
import type { NotifyLevel } from "../types/notification";

const TYPES = { Info: "info", Success: "success", Warning: "warning", Error: "error" } as const;
// Errors stay until closed
const DURATIONS: Record<NotifyLevel, number> = { Info: 4000, Success: 4000, Warning: 6000, Error: Infinity };

/** Shows a toast. */
export function addNotification(input: { level: NotifyLevel; message: string }) {
  toast[TYPES[input.level]](input.message, { duration: DURATIONS[input.level] });
}
