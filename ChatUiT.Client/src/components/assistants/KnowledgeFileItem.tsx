import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import IconButton from '../common/IconButton';
import TextInput from '../common/TextInput';
import type { FileUpload } from '../../types/fileModels';
import Card from '../common/Card';
import { ListItem } from '../common/List';

export type KnowledgeFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

export interface KnowledgeFileItemData {
  id: string;
  name: string;
  description?: string;
  // Set for a file picked in the form. It is uploaded when the assistant is saved.
  file?: File;
  // Set for a file that is stored on the server. Its original opens on demand.
  fileId?: string;
  // Per scheme, for stored files, as counted by the server.
  tokenCounts?: Record<string, number>;
  // The file's upload while the assistant is being saved.
  upload?: Pick<FileUpload, 'status' | 'progress'>;
}

interface KnowledgeFileItemProps {
  item: KnowledgeFileItemData;
  onPreview?: () => void;
  onRemove?: () => void;
  allowDescription?: boolean;
  descriptionPlaceholder?: string;
  onDescriptionChange?: (description: string) => void;
  disabled?: boolean;
  /** Shown after the name: the file's token count, or how far its upload has come. */
  trailingLabel?: string;
}

const KnowledgeFileItem = ({
  item,
  onPreview,
  onRemove,
  allowDescription = false,
  descriptionPlaceholder = '',
  onDescriptionChange,
  disabled = false,
  trailingLabel
}: KnowledgeFileItemProps) => {
  const { t } = useTranslation();
  const isDescriptionMissing = allowDescription && !item.description?.trim();

  return (
    <Card padding="xs" gap="xs">
      <ListItem
        density="compact"
        leading={<Icon name="file" color="muted" />}
        title={item.name}
        trailing={trailingLabel}
        onClick={onPreview}
        disabled={!onPreview}
        actions={onRemove && !disabled && (
          <IconButton icon="trash" label={t('files.removeFile')} size="small" onClick={onRemove} />
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
