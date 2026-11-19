import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog as UiDialog, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import IconButton from '../IconButton';
import './Dialog.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size: 'small' | 'medium' | 'xl';
  // The buttons in the footer
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** A modal over a scrim: a title bar, the content, and a footer with its buttons. */
export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, size, footer, children }) => {
  const { t } = useTranslation();
  return (
    <UiDialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={`dialog-container dialog-size-${size}`}>
        <div className="dialog-header">
          <DialogTitle className="dialog-title t-title">{title}</DialogTitle>
          <DialogClose render={<IconButton icon="close" label={t('common.close')} />} />
        </div>
        <div className="dialog-content">
          <div className="dialog-main">{children}</div>
        </div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </DialogContent>
    </UiDialog>
  );
};
