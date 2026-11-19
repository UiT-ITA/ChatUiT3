/**
 * Browser storage for a ui-sdk Resizable layout that saves only while shouldSave returns true.
 * When the browser blocks storage or it is full, reading finds nothing and saving does nothing.
 */
export const layoutStorage = (shouldSave: () => boolean) => ({
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (!shouldSave()) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // The layout is kept for this visit only
    }
  },
});
