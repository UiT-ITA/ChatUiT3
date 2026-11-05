/** The value of a design token on the page root. */
export const tokenValue = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
