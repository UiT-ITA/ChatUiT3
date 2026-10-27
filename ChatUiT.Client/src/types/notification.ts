export type NotifyLevel = "Info" | "Success" | "Warning" | "Error";

export interface Notification {
  id: string;
  level: NotifyLevel;
  message: string;
}
