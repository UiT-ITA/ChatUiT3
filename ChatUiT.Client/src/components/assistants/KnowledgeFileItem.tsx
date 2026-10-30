import { Icon } from '../common/Icon';
import IconButton from '../common/IconButton';
import TextInput from '../common/TextInput';
import type { ChatFile } from '../../types/fileModels';
import Card from '../common/Card';
import { ListItem } from '../common/List';

export type KnowledgeFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

export interface KnowledgeFileItemData {
  id: string;
  name: string;
  description?: string;
  ChatFile?: ChatFile;
  // Set for files that are already stored on the server; their content is
  // fetched on demand.
  fileId?: string;
  // Per scheme, for stored files. New files are counted on the client.
  tokenCounts?: Record<string, number>;
}

interface KnowledgeFileItemProps {
  item: KnowledgeFileItemData;
  onPreview?: () => void;
  onRemove?: () => void;
  allowDescription?: boolean;
  descriptionPlaceholder?: string;
  onDescriptionChange?: (description: string) => void;
  disabled?: boolean;
  tokenLabel?: string;
}

const KnowledgeFileItem = ({
  item,
  onPreview,
  onRemove,
  allowDescription = false,
  descriptionPlaceholder = '',
  onDescriptionChange,
  disabled = false,
  tokenLabel
}: KnowledgeFileItemProps) => {
  const isDescriptionMissing = allowDescription && !item.description?.trim();

  return (
    <Card padding="xs" gap="xs">
      <ListItem
        density="compact"
        leading={<Icon name="file" color="muted" />}
        title={item.name}
        trailing={tokenLabel}
        onClick={onPreview}
        disabled={disabled || !onPreview}
        actions={onRemove && !disabled && (
          <IconButton icon="trash" label="Remove file" size="small" onClick={onRemove} />
        )}
      />
      {allowDescription && (
        <TextInput
          size="small"
          value={item.description ?? ''}
          onChange={(value) => onDescriptionChange?.(value)}
          invalid={isDescriptionMissing}
          placeholder={descriptionPlaceholder}
          disabled={disabled}
          required
        />
      )}
    </Card>
  );
};

export default KnowledgeFileItem;
