import React from 'react';
import { Radio } from '@ui-sdk/react/radio';
import { Checkbox, CheckboxIndicator } from '@ui-sdk/react/checkbox';
import { Icon } from './Icon';
import { cx } from './layout';
import './Checkbox.css';
import './ChoiceOption.css';

interface ChoiceOptionProps {
  // 'radio' goes in a ui-sdk RadioGroup, 'check' in a ui-sdk CheckboxGroup
  mode: 'radio' | 'check';
  // The value it gives the group around it
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  // Marks the option as the right or the wrong answer once it has been graded
  outcome?: 'correct' | 'wrong';
  disabled?: boolean;
}

/** A framed choice in a ui-sdk radio or checkbox group: a mark, a label and an optional description. */
const ChoiceOption: React.FC<ChoiceOptionProps> = ({ mode, value, label, description, outcome, disabled }) => (
  <label className={cx('choice-option', outcome && `choice-option--${outcome}`)}>
    {mode === 'radio'
      ? <Radio value={value} disabled={disabled} className="choice-option__radio" />
      : <Checkbox value={value} disabled={disabled}><CheckboxIndicator /></Checkbox>}
    <span className="choice-option__text">
      <span className="t-ui">{label}</span>
      {description && <span className="choice-option__description t-caption">{description}</span>}
    </span>
    {outcome && <Icon name={outcome === 'correct' ? 'check' : 'close'} size="sm" color={outcome === 'correct' ? 'success' : 'danger'} className="choice-option__outcome" />}
  </label>
);

export default ChoiceOption;
