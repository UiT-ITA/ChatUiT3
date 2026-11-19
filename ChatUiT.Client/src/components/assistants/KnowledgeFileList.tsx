import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileInput, FileInputTrigger } from '@ui-sdk/react/file-input';
import { FileProcessingService } from '../../services/fileProcessingService';
import type { ChatFile } from '../../types/fileModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
import FilePreviewModal from '../chat/FilePreviewModal';
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
  onFilesSelected: (files: ChatFile[]) => void;
  onLoadFile?: (item: KnowledgeFileItemData) => Promise<ChatFile | null>;
  items?: KnowledgeFileItemData[];
  disabled?: boolean;
  /** Marks the category as not implemented yet: disables it and shows a badge. */
  unavailable?: boolean;
  allowItemDescription?: boolean;
  itemDescriptionPlaceholder?: string;
  onItemDescriptionChange?: (itemId: string, description: string) => void;
  onItemRemove?: (itemId: string) => void;
  /** The token count shown on each file, or undefined to show none. */
  itemTokenLabel?: (item: KnowledgeFileItemData) => string | undefined;
  /** Shown between the header and the files. */
  status?: React.ReactNode;
}

const NO_FILES: File[] = [];

const KnowledgeFileList = ({
  title,
  description,
  emptyLabel,
  onFilesSelected,
  onLoadFile,
  items = [],
  disabled = false,
  unavailable = false,
  allowItemDescription = false,
  itemDescriptionPlaceholder = '',
  onItemDescriptionChange,
  onItemRemove,
  itemTokenLabel,
  status
}: KnowledgeFileListProps) => {
  const { t } = useTranslation();
  const [previewFile, setPreviewFile] = useState<ChatFile | null>(null);

  const isDisabled = disabled || unavailable;

  const handleFiles = async (files: File[]) => {
    const valid = files.filter((file) => isValidFileType(file));
    if (valid.length > 0) onFilesSelected(await FileProcessingService.importFiles(valid, 'A knowledge file could not be imported'));
  };

  const handlePreview = async (item: KnowledgeFileItemData) => {
    const file = item.ChatFile ?? (await onLoadFile?.(item));
    if (file) setPreviewFile(file);
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
          <FileInput multiple accept={SUPPORTED_IMPORT_ACCEPT} value={NO_FILES} onValueChange={(_, details) => { void handleFiles(details.added); }} disabled={isDisabled}>
            <FileInputTrigger render={<Button variant="subtle" size="small" disabled={isDisabled}>{t('assistants.knowledge.addFiles')}</Button>} />
          </FileInput>
        )}
        between={status}
      >
        {items.length > 0 ? items.map((item) => (
          <KnowledgeFileItem
            key={item.id}
            item={item}
            onPreview={item.ChatFile || (onLoadFile && item.fileId) ? () => void handlePreview(item) : undefined}
            onRemove={onItemRemove ? () => onItemRemove(item.id) : undefined}
            allowDescription={allowItemDescription}
            descriptionPlaceholder={itemDescriptionPlaceholder}
            onDescriptionChange={(value) => onItemDescriptionChange?.(item.id, value)}
            disabled={isDisabled}
            tokenLabel={itemTokenLabel?.(item)}
          />
        )) : (
          <Text as="div" variant="ui-plain" tone="muted" leading="base">{emptyLabel}</Text>
        )}
      </PanelSection>

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </>
  );
};

export default KnowledgeFileList;
