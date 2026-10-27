import { signal } from "@preact/signals-react";
import type { Notification, NotifyLevel } from "../types/notification";

export const notifications = signal<Notification[]>([]);

export function addNotification(input: { level: NotifyLevel; message: string }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: Notification = { id, level: input.level, message: input.message };
  notifications.value = [item, ...notifications.value].slice(0, 5);
  const autoMs = item.level === "Success" || item.level === "Info" ? 4000 : item.level === "Warning" ? 6000 : 0;
  if (autoMs > 0) {
    setTimeout(() => removeNotification(id), autoMs);
  }
}

export function removeNotification(id: string) {
  notifications.value = notifications.value.filter(n => n.id !== id);
}
