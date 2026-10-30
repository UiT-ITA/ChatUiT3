import type React from 'react';
import { cx } from './layout';

/** The label and notes a form input can show. Every input takes these. */
export interface FieldProps {
  label?: React.ReactNode;
  // Content at the right end of the label row, such as a current value
  labelAside?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

export const hasFieldProps = ({ label, labelAside, description, error }: FieldProps): boolean =>
  Boolean(label || labelAside || description || error);

/** The aria-describedby value that links a control to its notes. */
export const fieldDescribedBy = (id: string, { description, error }: FieldProps): string | undefined =>
  cx(description && `${id}-description`, error && `${id}-error`) || undefined;
