import React, { createContext, useContext, useId, useState } from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';

interface CollapsibleState {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  disabled: boolean;
}

const CollapsibleContext = createContext<CollapsibleState | null>(null);

const useCollapsible = (): CollapsibleState => {
  const state = useContext(CollapsibleContext);
  if (!state) throw new Error('CollapsibleTrigger and CollapsibleContent must be inside a Collapsible');
  return state;
};

interface CollapsibleProps extends LayoutProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Content that a trigger shows and hides. Holds a CollapsibleTrigger and a CollapsibleContent anywhere inside it. */
export const Collapsible: React.FC<CollapsibleProps> = ({ open: controlledOpen, defaultOpen = false, onOpenChange, disabled = false, className, children, ...props }) => {
  const [layout] = splitLayoutProps(props);
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const contentId = useId();
  const open = controlledOpen ?? ownOpen;

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  return (
    <CollapsibleContext.Provider value={{ open, setOpen, contentId, disabled }}>
      <div className={cx('collapsible', className)} style={layout}>{children}</div>
    </CollapsibleContext.Provider>
  );
};

type TriggerProps = React.HTMLAttributes<HTMLElement> & { 'aria-expanded'?: boolean; 'aria-controls'?: string };

/** Makes its child, normally a Button, toggle the Collapsible. */
export const CollapsibleTrigger: React.FC<{ children: React.ReactElement<TriggerProps> }> = ({ children }) => {
  const { open, setOpen, contentId, disabled } = useCollapsible();
  return React.cloneElement(children, {
    'aria-expanded': open,
    'aria-controls': contentId,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onClick?.(event);
      if (!disabled) setOpen(!open);
    },
  });
};

/** The part of a Collapsible that shows only while it is open. */
export const CollapsibleContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  const { open, contentId } = useCollapsible();
  return open ? <div id={contentId} className={className}>{children}</div> : null;
};
