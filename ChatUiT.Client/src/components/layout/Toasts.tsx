import { useTranslation } from 'react-i18next';
import { Toast, ToastClose, ToastRegion, ToastTitle } from '@ui-sdk/react/toast';
import IconButton from '../common/IconButton';
import '../common/Toast.css';

/** The toasts of the notification service, in the top-right corner, each with a close button. */
const Toasts: React.FC = () => {
  const { t } = useTranslation();
  return (
    <ToastRegion side="top" align="end" maxVisible={5} expanded className="toast-region">
      {() => (
        <Toast className="toast">
          <ToastTitle className="toast-message t-body" />
          <ToastClose render={<IconButton icon="close" label={t('common.close')} size="small" />} />
        </Toast>
      )}
    </ToastRegion>
  );
};

export default Toasts;
