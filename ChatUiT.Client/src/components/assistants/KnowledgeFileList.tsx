import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileProcessingService } from '../../services/fileProcessingService';
import type { ChatFile } from '../../types/fileModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
import FilePreviewModal from '../chat/FilePreviewModal';
import { addNotification } from '../../services/notificationService';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<ChatFile | null>(null);

  const isDisabled = disabled || unavailable;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 0) {
      const validFiles = files.filter((file) => isValidFileType(file));
      const results = await Promise.allSettled(validFiles.map((file) => FileProcessingService.processFile(file)));

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') return;
        const file = validFiles[index];
        const reason = result.reason instanceof Error ? result.reason.message : 'File processing failed';
        console.error(`Failed to process knowledge file ${file.name}:`, result.reason);
        addNotification({ level: 'Error', message: `${file.name}: ${reason}` });
      });

      onFilesSelected(results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []));
    }

    event.target.value = '';
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
          <Button
            variant="subtle"
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
          >
            {t('assistants.knowledge.addFiles')}
          </Button>
        )}
        between={(
          <>
            {status}

            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept={SUPPORTED_IMPORT_ACCEPT}
              onChange={handleFileChange}
              disabled={isDisabled}
            />
          </>
        )}
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
