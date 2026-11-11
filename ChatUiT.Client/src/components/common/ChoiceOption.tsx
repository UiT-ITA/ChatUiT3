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
  // Marks the option as the right or the wrong answer once it has been graded
  outcome?: 'correct' | 'wrong';
}

/** A framed choice button with a radio or check mark, a label and an optional description. */
const ChoiceOption: React.FC<ChoiceOptionProps> = ({ mode, picked, label, description, outcome, className, ...props }) => (
  <button
    type="button"
    role={mode === 'check' ? 'checkbox' : 'radio'}
    aria-checked={picked}
    className={cx('choice-option', picked && 'choice-option--picked', outcome && `choice-option--${outcome}`, className)}
    {...props}
  >
    <span className={`choice-option__mark choice-option__mark--${mode}`} aria-hidden="true">
      {picked && mode === 'check' && <Icon name="check" size="sm" />}
    </span>
    <span className="choice-option__text">
      <span className="t-ui">{label}</span>
      {description && <span className="choice-option__description t-caption">{description}</span>}
    </span>
    {outcome && <Icon name={outcome === 'correct' ? 'check' : 'close'} size="sm" color={outcome === 'correct' ? 'success' : 'danger'} className="choice-option__outcome" />}
  </button>
);

export default ChoiceOption;
