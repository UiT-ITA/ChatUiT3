import { useState, useRef, useEffect, type ReactNode } from 'react';
import './ComposerPopover.css';

interface ComposerPopoverProps {
  trigger: ReactNode;
  label: string;
  className?: string;
  children: ReactNode;
}

/** A composer toolbar item whose content opens above it on hover, or on a tap where there is no hover. */
export default function ComposerPopover({ trigger, label, className, children }: ComposerPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`composer-popover ${open ? 'open' : ''} ${className ?? ''}`}>
      <button
        type="button"
        className="composer-popover-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {trigger}
      </button>
      <div className="composer-popover-content">{children}</div>
    </div>
  );
}
