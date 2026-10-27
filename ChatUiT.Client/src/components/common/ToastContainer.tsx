import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { notifications, removeNotification } from "../../services/notificationService";
import type { NotifyLevel } from "../../types/notification";
import { Icon } from "./Icon";
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

const ToastContainer: React.FC = () => {
  useSignals(); // subscribe to signal updates
  const list = notifications;

  return (
    <div className="toast-container top-right">
      {list.value.map(n => (
        <div key={n.id} className={`toast ${levelClass(n.level)}`}>
          <div className="toast-message t-body">{n.message}</div>
          <button className="toast-close" aria-label="Close" onClick={() => removeNotification(n.id)}>
            <Icon name="close" size={1} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
