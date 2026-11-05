import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

interface DismissOptions {
  // Close on a pointer press outside the element
  outsideClick: boolean;
  // Close on Escape
  escape: boolean;
}

/** Calls onDismiss on a pointer press outside the element, or on Escape, while active. */
const useDismiss = (ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void, { outsideClick, escape }: DismissOptions): void => {
  const latest = useRef({ ref, onDismiss });
  useLayoutEffect(() => {
    latest.current = { ref, onDismiss };
  });

  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!latest.current.ref.current?.contains(event.target as Node)) latest.current.onDismiss();
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
