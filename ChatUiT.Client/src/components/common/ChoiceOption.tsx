import React from 'react';
import { Icon } from './Icon';
import { cx } from './layout';
import './ChoiceOption.css';

interface ChoiceOptionProps extends Omit<React.ComponentProps<'button'>, 'type' | 'role'> {
  // 'radio' picks one of a set, 'check' picks any number
  mode: 'radio' | 'check';
  picked: boolean;
  label: React.ReactNode;
  description?: React.ReactNode;
}

/** A framed choice button with a radio or check mark, a label and an optional description. */
const ChoiceOption: React.FC<ChoiceOptionProps> = ({ mode, picked, label, description, className, ...props }) => (
  <button
    type="button"
    role={mode === 'check' ? 'checkbox' : 'radio'}
    aria-checked={picked}
    className={cx('choice-option', picked && 'choice-option--picked', className)}
    {...props}
  >
    <span className={`choice-option__mark choice-option__mark--${mode}`} aria-hidden="true">
      {picked && mode === 'check' && <Icon name="check" size="sm" />}
    </span>
    <span className="choice-option__text">
      <span className="t-ui">{label}</span>
      {description && <span className="choice-option__description t-caption">{description}</span>}
    </span>
  </button>
);

export default ChoiceOption;
