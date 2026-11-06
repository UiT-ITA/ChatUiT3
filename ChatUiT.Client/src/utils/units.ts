/** A pixel length as rem, relative to the root font size. */
export function pxToRem(px: number): string {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return `${px / rootFontSize}rem`;
}
