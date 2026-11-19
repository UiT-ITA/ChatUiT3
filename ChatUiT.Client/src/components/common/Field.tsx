import React from 'react';
import { Field as UiField, FieldDescription as UiFieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import type { FieldProps } from './fieldProps';
import './Field.css';

interface FieldDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'warning' | 'danger';
}

/** A note under a control that is not inside a Field, in the caption style. */
export const FieldDescription: React.FC<FieldDescriptionProps> = ({ tone = 'default', className, ...rest }) => (
  <div className={cx('field__description', 't-caption', tone !== 'default' && `field__description--${tone}`, className)} {...rest} />
);

interface FieldComponentProps extends FieldProps, LayoutProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** A label, a control and the notes under it. ui-sdk connects the label and notes to the control inside. */
const Field: React.FC<FieldComponentProps> = ({ label, labelAside, description, error, required = false, className, style, children, ...props }) => {
  const [layout] = splitLayoutProps(props);
  const labelElement = label && (
    <FieldLabel className="field__label t-label">
      {label}
      {required && <span className="field__required" aria-hidden="true"> *</span>}
    </FieldLabel>
  );

  return (
    <UiField className={cx('field', className)} style={{ ...layout, ...style }} invalid={error ? true : undefined}>
      {labelAside ? (
        <div className="field__label-row">
          {labelElement}
          {labelAside}
        </div>
      ) : labelElement}
      {children}
      {description && <UiFieldDescription className="field__description t-caption">{description}</UiFieldDescription>}
      {error && <FieldError match className="field__description field__description--danger t-caption">{error}</FieldError>}
    </UiField>
  );
};

export default Field;
