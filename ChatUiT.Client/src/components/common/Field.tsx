import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import type { FieldProps } from './fieldProps';
import './Field.css';

interface FieldDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'warning' | 'danger';
}

/** A note under a control. Field and the inputs render it from their description and error props. */
export const FieldDescription: React.FC<FieldDescriptionProps> = ({ tone = 'default', className, ...rest }) => (
  <div className={cx('field__description', 't-caption', tone !== 'default' && `field__description--${tone}`, className)} {...rest} />
);

interface FieldComponentProps extends FieldProps, LayoutProps {
  // The id of the control the label names
  htmlFor?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** A label, a control and the notes under it. Wraps custom controls; the inputs use it themselves. */
const Field: React.FC<FieldComponentProps> = ({ label, labelAside, description, error, required = false, htmlFor, className, children, ...props }) => {
  const [style] = splitLayoutProps(props);
  const labelElement = label && (
    <label className="field__label t-label" htmlFor={htmlFor}>
      {label}
      {required && <span className="field__required" aria-hidden="true"> *</span>}
    </label>
  );

  return (
    <div className={cx('field', className)} style={style}>
      {labelAside ? (
        <div className="field__label-row">
          {labelElement}
          {labelAside}
        </div>
      ) : labelElement}
      {children}
      {description && <FieldDescription id={htmlFor && `${htmlFor}-description`}>{description}</FieldDescription>}
      {error && <FieldDescription id={htmlFor && `${htmlFor}-error`} tone="danger" role="alert">{error}</FieldDescription>}
    </div>
  );
};

export default Field;
