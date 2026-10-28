import type { ContextLevel } from '../../services/contextUsageService';

interface ContextRingProps {
  fraction: number;
  level: ContextLevel;
}

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A small circle that fills clockwise with how much of the context window is used. */
export default function ContextRing({ fraction, level }: ContextRingProps) {
  const filled = Math.min(Math.max(fraction, 0), 1) * CIRCUMFERENCE;

  return (
    <svg className="context-ring" data-state={level} viewBox="0 0 20 20" aria-hidden="true">
      <circle className="context-ring-track" cx="10" cy="10" r={RADIUS} />
      {filled > 0 && (
        <circle
          className="context-ring-fill"
          cx="10"
          cy="10"
          r={RADIUS}
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          transform="rotate(-90 10 10)"
        />
      )}
    </svg>
  );
}
