import React from 'react';
import { Radio, RadioIndicator } from '@ui-sdk/react/radio';
import { Icon } from './Icon';
import './CornerCheck.css';
import './ChoiceCard.css';

interface ChoiceCardProps {
  // The value it gives the RadioGroup around it
  value: string;
  label: React.ReactNode;
  // A preview of the choice, above the label
  children: React.ReactNode;
}

/** A framed choice in a ui-sdk RadioGroup: a preview and a label, and a check in the corner when chosen. */
const ChoiceCard: React.FC<ChoiceCardProps> = ({ value, label, children }) => (
  <label className="card card--anchor choice-card">
    {children}
    <span className="t-body-strong">{label}</span>
    <Radio value={value} className="choice-card__radio">
      <RadioIndicator className="corner-check"><Icon name="check" size="sm" /></RadioIndicator>
    </Radio>
  </label>
);

export default ChoiceCard;
