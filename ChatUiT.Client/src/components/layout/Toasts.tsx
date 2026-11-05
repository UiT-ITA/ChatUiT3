import { useSignals } from '@preact/signals-react/runtime';
import ToastContainer from '../common/ToastContainer';
import { notifications, removeNotification } from '../../services/notificationService';

/** The toasts of the notification service. */
const Toasts: React.FC = () => {
  useSignals();
  return <ToastContainer notifications={notifications.value} onClose={removeNotification} />;
};

export default Toasts;
