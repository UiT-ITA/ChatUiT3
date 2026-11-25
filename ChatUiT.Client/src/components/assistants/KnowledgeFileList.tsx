import { useTranslation } from 'react-i18next';
import { FileInput, FileInputTrigger } from '@ui-sdk/react/file-input';
import { SUPPORTED_IMPORT_ACCEPT, formatFileSize, isValidFileType } from '../../utils/fileUtils';
import { MAX_FILE_BYTES } from '../../services/fileService';
import { addNotification } from '../../services/notificationService';
import { ErrorCode, formatError } from '../../errors/errorCodes';
import { useFilePreview } from '../chat/useFilePreview';
import Button from '../common/Button';
import KnowledgeFileItem, { type KnowledgeFileItemData } from './KnowledgeFileItem';
import PanelSection from '../common/PanelSection';
import Text from '../common/Text';
import Badge from '../common/Badge';

export type { KnowledgeFileCategory, KnowledgeFileItemData } from './KnowledgeFileItem';

interface KnowledgeFileListProps {
  title: string;
  description: string;
  emptyLabel: string;
  /** Called with the picked files that are of a supported type and within the size limit. */
  onFilesSelected: (files: File[]) => void;
  /** Where the stored files are, for opening their originals. Without it a file does not open. */
  filesEndpoint?: string;
  items?: KnowledgeFileItemData[];
  disabled?: boolean;
  /** Marks the category as not implemented yet: disables it and shows a badge. */
  unavailable?: boolean;
  allowItemDescription?: boolean;
  itemDescriptionPlaceholder?: string;
  onItemDescriptionChange?: (itemId: string, description: string) => void;
  onItemRemove?: (itemId: string) => void;
  /** The text shown after each file's name, or undefined to show none. */
  itemTrailingLabel?: (item: KnowledgeFileItemData) => string | undefined;
  /** Shown between the header and the files. */
  status?: React.ReactNode;
}

const NO_FILES: File[] = [];

const KnowledgeFileList = ({
  title,
  description,
  emptyLabel,
  onFilesSelected,
  filesEndpoint,
  items = [],
  disabled = false,
  unavailable = false,
  allowItemDescription = false,
  itemDescriptionPlaceholder = '',
  onItemDescriptionChange,
  onItemRemove,
  itemTrailingLabel,
  status
}: KnowledgeFileListProps) => {
  const { t } = useTranslation();
  const preview = useFilePreview();

  const isDisabled = disabled || unavailable;

  const handleFiles = (files: File[]) => {
    const accepted: File[] = [];
    for (const file of files) {
      if (!isValidFileType(file)) {
        addNotification({ level: 'Warning', message: `${file.name}: ${formatError(t('files.typeNotSupported'), ErrorCode.FileTypeNotSupported)}` });
      } else if (file.size > MAX_FILE_BYTES) {
        addNotification({ level: 'Warning', message: `${file.name}: ${formatError(t('files.tooLarge', { limit: formatFileSize(MAX_FILE_BYTES) }), ErrorCode.FileTooLarge)}` });
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length > 0) onFilesSelected(accepted);
  };

  return (
    <>
      <PanelSection
        dimmed={unavailable}
        aria-label={title}
        title={(
          <>
            {title}
            {unavailable && (
              <Badge ml="sm">{t('assistants.knowledge.notAvailableYet')}</Badge>
            )}
          </>
        )}
        description={description}
        action={(
          <FileInput multiple accept={SUPPORTED_IMPORT_ACCEPT} value={NO_FILES} onValueChange={(_, details) => handleFiles(details.added)} disabled={isDisabled}>
            <FileInputTrigger render={<Button variant="subtle" size="small" disabled={isDisabled}>{t('assistants.knowledge.addFiles')}</Button>} />
          </FileInput>
        )}
        between={status}
      >
        {items.length > 0 ? items.map((item) => (
          <KnowledgeFileItem
            key={item.id}
            item={item}
            onPreview={filesEndpoint && item.fileId ? preview.open(item.name, filesEndpoint, item.fileId) : undefined}
            onRemove={onItemRemove ? () => onItemRemove(item.id) : undefined}
            allowDescription={allowItemDescription}
            descriptionPlaceholder={itemDescriptionPlaceholder}
            onDescriptionChange={(value) => onItemDescriptionChange?.(item.id, value)}
            disabled={isDisabled}
            trailingLabel={itemTrailingLabel?.(item)}
          />
        )) : (
          <Text as="div" variant="ui-plain" tone="muted" leading="base">{emptyLabel}</Text>
        )}
      </PanelSection>

      {preview.dialog}
    </>
  );
};

export default KnowledgeFileList;
