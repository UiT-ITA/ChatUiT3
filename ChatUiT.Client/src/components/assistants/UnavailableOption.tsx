import Checkbox, { type CheckboxProps } from '../common/Checkbox';
import Text from '../common/Text';

interface UnavailableOptionProps extends Omit<CheckboxProps, 'children'> {
  // The stored id that no longer names anything
  id: string;
  // Why it is unavailable
  note: string;
}

/** A ticked option whose id no longer names anything, struck through with the reason. Unticking it removes it. */
const UnavailableOption = ({ id, note, ...props }: UnavailableOptionProps) => (
  <Checkbox {...props}>
    <span>
      <Text variant="table-strong" tone="muted" strike>{id}</Text>
      <Text tone="muted"> — {note}</Text>
    </span>
  </Checkbox>
);

export default UnavailableOption;
