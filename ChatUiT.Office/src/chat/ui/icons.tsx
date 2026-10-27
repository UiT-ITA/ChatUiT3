/** The pane's icons, as inline SVG. Filled icons are react-icons md and ri, as in the ChatUiT app. */

const filled = {
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  stop: "M6 6h12v12H6z",
  more: "M5 10.3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm7 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm7 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z",
} as const;

/** Outline icons, drawn with a 1.8px stroke. */
const outlined = {
  history: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2",
  chatNew: "M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12zM12 9v6M9 12h6",
  attach: "M20 11.5l-8.1 8.1a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8",
  send: "M12 19V5M6 11l6-6 6 6",
  check: "M5 12l5 5 9-10",
  failed: "M18 6L6 18M6 6l12 12",
  chevron: "M9 6l6 6-6 6",
} as const;

export type IconName = keyof typeof filled | keyof typeof outlined;

/** `size` is in rem. */
export function Icon({ name, size = 1 }: { name: IconName; size?: number }) {
  const dimensions = { width: `${size}rem`, height: `${size}rem`, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  if (name in filled) {
    return (
      <svg {...dimensions} fill="currentColor">
        <path d={filled[name as keyof typeof filled]} />
      </svg>
    );
  }
  return (
    <svg
      {...dimensions}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={outlined[name as keyof typeof outlined]} />
    </svg>
  );
}
