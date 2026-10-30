import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

type ElementRef = RefObject<HTMLElement | null>;

interface DismissOptions {
  // Close on a pointer press outside the elements. On by default.
  outsideClick?: boolean;
  // Close on Escape. On by default.
  escape?: boolean;
}

/** Calls onDismiss on a pointer press outside every given element, or on Escape, while active. */
const useDismiss = (refs: ElementRef | ElementRef[], active: boolean, onDismiss: () => void, options: DismissOptions = {}): void => {
  const { outsideClick = true, escape = true } = options;
  const latest = useRef({ refs, onDismiss });
  useLayoutEffect(() => {
    latest.current = { refs, onDismiss };
  });

  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const list = Array.isArray(latest.current.refs) ? latest.current.refs : [latest.current.refs];
      if (!list.some(ref => ref.current?.contains(target))) latest.current.onDismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current.onDismiss();
    };

    if (outsideClick) document.addEventListener('pointerdown', handlePointerDown);
    if (escape) document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, outsideClick, escape]);
};

export default useDismiss;
