export type ScaleName = 'small' | 'medium' | 'large' | 'xl';

export const SCALE_OPTIONS = [
  { value: 'small', label: 'Small', fontSize: '12px' },
  { value: 'medium', label: 'Medium', fontSize: '16px' },
  { value: 'large', label: 'Large', fontSize: '20px' },
  { value: 'xl', label: 'Extra Large', fontSize: '24px' },
] as const;

export function setScale(scaleName: ScaleName): void {
  const scaleOption = SCALE_OPTIONS.find(option => option.value === scaleName);
  if (scaleOption) {
    document.documentElement.style.fontSize = scaleOption.fontSize;
  }
}

export function getCurrentScale(): ScaleName {
  const currentSize = document.documentElement.style.fontSize;
  const scaleOption = SCALE_OPTIONS.find(option => option.fontSize === currentSize);
  return scaleOption?.value || 'medium';
}
