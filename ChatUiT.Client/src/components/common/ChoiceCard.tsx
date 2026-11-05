import React from 'react';
import Card from './Card';
import CornerCheck from './CornerCheck';

interface ChoiceCardProps {
  label: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  // A preview of the choice, above the label
  children: React.ReactNode;
}

/** A framed choice button with a preview and a label, and a check in the corner when selected. */
const ChoiceCard: React.FC<ChoiceCardProps> = ({ label, selected, onSelect, children }) => (
  <Card as="button" padding="sm" strongFrame anchor selected={selected} onClick={onSelect}>
    {children}
    <span className="t-body-strong">{label}</span>
    {selected && <CornerCheck />}
  </Card>
);

export default ChoiceCard;
