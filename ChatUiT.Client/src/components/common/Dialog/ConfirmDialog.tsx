import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@ui-sdk/react/alert-dialog';
import Button from '../Button';
import IconButton from '../IconButton';
import './Dialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  // A returned promise keeps the dialog busy until it settles: nothing closes it meanwhile
  onConfirm: () => unknown;
  onCancel: () => void;
}

/** A yes/no question with a danger confirm button. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, confirmLabel, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={isOpen} onOpenChange={open => { if (!open) onCancel(); }} dismissible={!busy}>
      <AlertDialogContent className="dialog-container dialog-size-medium">
        <div className="dialog-header">
          <AlertDialogTitle className="dialog-title t-title">{title}</AlertDialogTitle>
          <AlertDialogClose disabled={busy} render={<IconButton icon="close" label={t('common.close')} />} />
        </div>
        <div className="dialog-content">
          <AlertDialogDescription className="dialog-main t-body">{message}</AlertDialogDescription>
        </div>
        <div className="dialog-footer">
          <AlertDialogClose disabled={busy} render={<Button variant="secondary">{t('common.cancel')}</Button>} />
          <Button variant="danger" onClick={confirm}>{confirmLabel}</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
