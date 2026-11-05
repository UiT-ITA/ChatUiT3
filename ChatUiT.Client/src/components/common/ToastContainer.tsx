import React from "react";
import { useTranslation } from "react-i18next";
import type { Notification, NotifyLevel } from "../../types/notification";
import IconButton from "./IconButton";
import "./ToastContainer.css";

function levelClass(level: NotifyLevel) {
  switch (level) {
    case "Error":
      return "toast-error";
    case "Warning":
      return "toast-warning";
    case "Success":
      return "toast-success";
    default:
      return "toast-info";
  }
}

interface ToastContainerProps {
  notifications: Notification[];
  onClose: (id: Notification["id"]) => void;
}

/** The stack of toasts in the top-right corner, each with a close button. */
const ToastContainer: React.FC<ToastContainerProps> = ({ notifications, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="toast-container top-right">
      {notifications.map(n => (
        <div key={n.id} className={`toast ${levelClass(n.level)}`}>
          <div className="toast-message t-body">{n.message}</div>
          <IconButton icon="close" label={t('common.close')} size="small" onClick={() => onClose(n.id)} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
