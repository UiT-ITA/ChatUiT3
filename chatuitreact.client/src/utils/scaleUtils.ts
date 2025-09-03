export type ScaleName = 'small' | 'medium' | 'large' | 'extra-large';

export const SCALE_OPTIONS = [
  { value: 'small', label: 'Small', fontSize: '12px' },
  { value: 'medium', label: 'Medium', fontSize: '16px' },
  { value: 'large', label: 'Large', fontSize: '20px' },
  { value: 'extra-large', label: 'Extra Large', fontSize: '24px' },
] as const;

export function setScale(scaleName: ScaleName): void {
  const scaleOption = SCALE_OPTIONS.find(option => option.value === scaleName);
  if (scaleOption) {
    document.documentElement.style.fontSize = scaleOption.fontSize;
    localStorage.setItem('uiScale', scaleName);
  }
}

export function getCurrentScale(): ScaleName {
  const currentSize = document.documentElement.style.fontSize;
  const scaleOption = SCALE_OPTIONS.find(option => option.fontSize === currentSize);
  return scaleOption?.value || 'medium';
}

export function getStoredScale(): ScaleName {
  const stored = localStorage.getItem('uiScale') as ScaleName;
  return stored && SCALE_OPTIONS.some(option => option.value === stored) ? stored : 'medium';
}

export function initializeScale(): void {
  const savedScale = getStoredScale();
  setScale(savedScale);
}
