/**
 * Formats a duration for the activity panel: whole seconds under a minute, minutes and
 * seconds above. Sub-second values round up to 1 s so a finished step never reads as 0 s.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}
