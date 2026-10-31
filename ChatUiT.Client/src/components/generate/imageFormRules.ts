import type { ImageFormat, ImageModelCapabilities } from '../../types/modelModels';

/** A reason the form cannot be sent, as an i18n key under generate.image.rules and its values. */
export interface RuleProblem {
  key: string;
  values?: Record<string, number | string>;
}

const BYTES_PER_MEGABYTE = 1024 * 1024;

/** The format of a picked file, from its MIME type. Null for anything else. */
export function formatOfFile(file: File): ImageFormat | null {
  switch (file.type) {
    case 'image/png': return 'Png';
    case 'image/jpeg': return 'Jpeg';
    case 'image/webp': return 'Webp';
    default: return null;
  }
}

/** Whether a background can be transparent in this format. */
export const allowsTransparency = (format: ImageFormat) => format === 'Png' || format === 'Webp';

/** The smallest and largest side a custom size can have, both on the model's size multiple. */
export function sideRange(caps: ImageModelCapabilities): { min: number; max: number | undefined; step: number } {
  const step = caps.sizeMultiple ?? 1;
  const min = Math.ceil((caps.minSide ?? 1) / step) * step;
  const max = caps.maxSide !== null ? Math.floor(caps.maxSide / step) * step : undefined;
  return { min, max, step };
}

/** The size rules a custom size breaks. Mirrors the server's ImageParameterValidator. */
export function customSizeProblems(caps: ImageModelCapabilities, width: number, height: number): RuleProblem[] {
  if (!(width > 0) || !(height > 0)) return [{ key: 'sizeMissing' }];

  const problems: RuleProblem[] = [];
  if (caps.sizeMultiple !== null && (width % caps.sizeMultiple !== 0 || height % caps.sizeMultiple !== 0)) {
    problems.push({ key: 'sizeMultiple', values: { multiple: caps.sizeMultiple } });
  }
  if (caps.minSide !== null && Math.min(width, height) < caps.minSide) {
    problems.push({ key: 'minSide', values: { min: caps.minSide } });
  }
  if (caps.maxSide !== null && Math.max(width, height) > caps.maxSide) {
    problems.push({ key: 'maxSide', values: { max: caps.maxSide } });
  }
  const pixels = width * height;
  if (caps.minPixels !== null && pixels < caps.minPixels) {
    problems.push({ key: 'minPixels', values: { min: caps.minPixels.toLocaleString() } });
  }
  if (caps.maxPixels !== null && pixels > caps.maxPixels) {
    problems.push({ key: 'maxPixels', values: { max: caps.maxPixels.toLocaleString() } });
  }
  if (caps.maxAspectRatio !== null && Math.max(width, height) / Math.min(width, height) > caps.maxAspectRatio) {
    problems.push({ key: 'maxAspectRatio', values: { max: caps.maxAspectRatio } });
  }
  return problems;
}

/** What is wrong with a picked image: a format the model does not take, or a file that is too large. */
export function fileProblem(file: File, formats: ImageFormat[], maxBytes: number | null): RuleProblem | null {
  const format = formatOfFile(file);
  if (!format || !formats.includes(format)) {
    return { key: 'fileFormat', values: { name: file.name, formats: formats.map(f => f.toUpperCase()).join(', ') } };
  }
  if (maxBytes !== null && file.size > maxBytes) {
    return { key: 'fileTooLarge', values: { name: file.name, max: Math.floor(maxBytes / BYTES_PER_MEGABYTE) } };
  }
  return null;
}
