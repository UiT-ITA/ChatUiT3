import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import { CAPABILITIES, type Capability } from './assistantCapabilities';
import './CapabilityTag.css';

interface CapabilityTagProps {
  capability: Capability;
  /** Shows only the icon; the name is the tooltip and the accessible label. */
  iconOnly?: boolean;
}

/** A model capability as its icon followed by its name. */
export default function CapabilityTag({ capability, iconOnly = false }: CapabilityTagProps) {
  const { t } = useTranslation();
  const icon = CAPABILITIES.find(c => c.key === capability)?.icon ?? 'info';
  const label = t(`assistants.capabilities.${capability}`);

  return (
    <span className="capability-tag t-status" title={label}>
      <Icon name={icon} size="sm" label={iconOnly ? label : undefined} />
      {!iconOnly && <span>{label}</span>}
    </span>
  );
}
