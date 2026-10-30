import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogButton } from './Dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// A yes/no dialog with a danger confirm button. While busy, nothing closes it.
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const close = () => {
    if (!busy) onCancel();
  };

  return (
    <Dialog isOpen={isOpen} onClose={close} title={title} size="medium">
      <p className="t-body">{message}</p>
      <DialogButton variant="secondary" onClick={close} disabled={busy}>
        {t('common.cancel')}
      </DialogButton>
      <DialogButton variant="danger" onClick={onConfirm} disabled={busy} autoFocus>
        {confirmLabel}
      </DialogButton>
    </Dialog>
  );
};
