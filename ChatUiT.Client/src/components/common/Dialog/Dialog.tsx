import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IconName } from '../Icon';
import Button from '../Button';
import IconButton from '../IconButton';
import NavItem from '../NavItem';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { MOBILE } from '../breakpoints';
import { cx } from '../layout';
import './Dialog.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'small' | 'medium' | 'large' | 'xl';
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  preventBodyScroll?: boolean;
  children: React.ReactNode;
}

/**
 * A modal over a scrim: a title bar, the content, and the DialogButton children in a footer.
 * Two or more DialogPage children show as pages with a sidebar to switch between them.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  size = 'large',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  preventBodyScroll = true,
  children,
}) => {
  const { t } = useTranslation();
  const mobile = useMediaQuery(MOBILE);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const childrenArray = React.Children.toArray(children);
  const dialogPages = childrenArray.filter(
    child => React.isValidElement(child) && child.type === DialogPage
  ) as React.ReactElement<DialogPageProps>[];
  const dialogButtons = childrenArray.filter(
    child => React.isValidElement(child) && child.type === DialogButton
  ) as React.ReactElement<DialogButtonProps>[];
  const otherChildren = childrenArray.filter(
    child => !React.isValidElement(child) || (child.type !== DialogPage && child.type !== DialogButton)
  );

  const hasSidebar = dialogPages.length >= 2;

  // The first page is active when the dialog opens
  if (isOpen && dialogPages.length > 0 && !activePageId) {
    setActivePageId(dialogPages[0].props.id);
  }

  // Stops the page behind the dialog from scrolling while it is open
  useEffect(() => {
    if (!isOpen || !preventBodyScroll) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, preventBodyScroll]);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const content = hasSidebar
    ? dialogPages.find(page => page.props.id === activePageId)?.props.children ?? null
    : otherChildren;

  return (
    <div className="dialog-overlay" onClick={(e) => { if (closeOnOverlayClick && e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog-container dialog-size-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title t-title">{title}</h2>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </div>

        <div className={cx('dialog-content', hasSidebar && 'dialog-content--with-sidebar')}>
          {hasSidebar && (
            <div className="dialog-sidebar">
              {dialogPages.map(({ props: { id, label, icon } }) => (
                <NavItem
                  key={id}
                  icon={icon}
                  active={activePageId === id}
                  indicator={mobile ? 'bottom' : 'start'}
                  onClick={() => setActivePageId(id)}
                >
                  {label}
                </NavItem>
              ))}
            </div>
          )}

          <div className="dialog-main">{content}</div>
        </div>

        {dialogButtons.length > 0 && (
          <div className="dialog-footer">
            {dialogButtons.map(button => React.cloneElement(button, { fullWidth: mobile }))}
          </div>
        )}
      </div>
    </div>
  );
};

interface DialogPageProps {
  id: string;
  label: string;
  icon?: IconName;
  children: React.ReactNode;
}

/** A page of a Dialog, listed in its sidebar. The Dialog renders the children of the active page. */
export const DialogPage: React.FC<DialogPageProps> = ({ children }) => <>{children}</>;

interface DialogButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  // Set by Dialog on narrow screens
  fullWidth?: boolean;
  children: React.ReactNode;
}

/** A button in the dialog's footer. */
export const DialogButton: React.FC<DialogButtonProps> = ({ variant = 'secondary', onClick, disabled = false, loading = false, autoFocus = false, fullWidth = false, children }) => (
  <Button variant={variant} fullWidth={fullWidth} onClick={onClick} disabled={disabled} loading={loading} autoFocus={autoFocus}>
    {children}
  </Button>
);
