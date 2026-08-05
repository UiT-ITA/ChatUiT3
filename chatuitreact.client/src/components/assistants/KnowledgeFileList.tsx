import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileProcessingService } from '../../services/fileProcessingService';
import type { ChatFile } from '../../types/fileModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
import FilePreviewModal from '../chat/FilePreviewModal';
import { addNotification } from '../../services/notificationService';
import KnowledgeFileItem, {
  type KnowledgeFileCategory,
  type KnowledgeFileItemData
} from './KnowledgeFileItem';
import './KnowledgeFileList.css';

export type { KnowledgeFileCategory, KnowledgeFileItemData } from './KnowledgeFileItem';

interface KnowledgeFileListProps {
  category: KnowledgeFileCategory;
  title: string;
  description: string;
  emptyLabel: string;
  onFilesSelected: (files: ChatFile[]) => void;
  onLoadFile?: (item: KnowledgeFileItemData) => Promise<ChatFile | null>;
  items?: KnowledgeFileItemData[];
  disabled?: boolean;
  allowItemDescription?: boolean;
  itemDescriptionPlaceholder?: string;
  onItemDescriptionChange?: (itemId: string, description: string) => void;
  onItemRemove?: (itemId: string) => void;
}

const KnowledgeFileList = ({
  category,
  title,
  description,
  emptyLabel,
  onFilesSelected,
  onLoadFile,
  items = [],
  disabled = false,
  allowItemDescription = false,
  itemDescriptionPlaceholder = '',
  onItemDescriptionChange,
  onItemRemove
}: KnowledgeFileListProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<ChatFile | null>(null);

  const handleAddClick = () => {
    if (disabled) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      const validFiles = Array.from(files)
        .filter((file) => isValidFileType(file));

      const processingResults = await Promise.allSettled(
        validFiles.map((file) => FileProcessingService.processFile(file))
      );

      const ChatFiles = processingResults.flatMap((result) => {
        return result.status === 'fulfilled' ? [result.value] : [];
      });

      processingResults.forEach((result, index) => {
        if (result.status !== 'rejected') {
          return;
        }

        const file = validFiles[index];
        if (!file) {
          return;
        }

          const reason = result.reason instanceof Error ? result.reason.message : 'File processing failed';
          console.error(`Failed to process knowledge file ${file.name}:`, result.reason);
          addNotification({
            level: 'Error',
            message: `${file.name}: ${reason}`
          });
      });

      onFilesSelected(ChatFiles);
    }

    event.target.value = '';
  };

  const handlePreview = async (item: KnowledgeFileItemData) => {
    if (item.ChatFile) {
      setPreviewFile(item.ChatFile);
      return;
    }

    if (onLoadFile) {
      const loaded = await onLoadFile(item);
      if (loaded) {
        setPreviewFile(loaded);
      }
    }
  };

  return (
    <>
      <section className="knowledge-file-list" aria-label={title}>
        <div className="knowledge-file-list__header">
          <div className="knowledge-file-list__heading">
            <h3 className="knowledge-file-list__title t-body-strong">{title}</h3>
            <p className="knowledge-file-list__description t-ui-plain">{description}</p>
          </div>

          <button
            type="button"
            className="knowledge-file-list__add-button t-ui"
            onClick={handleAddClick}
            disabled={disabled}
          >
            {t('assistants.knowledge.addFiles')}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="knowledge-file-list__file-input"
          multiple
          accept={SUPPORTED_IMPORT_ACCEPT}
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="knowledge-file-list__items">
          {items.length > 0 ? items.map((item) => (
            <KnowledgeFileItem
              key={item.id}
              item={item}
              category={category}
              onPreview={item.ChatFile || (onLoadFile && item.fileId) ? () => void handlePreview(item) : undefined}
              onRemove={onItemRemove ? () => onItemRemove(item.id) : undefined}
              allowDescription={allowItemDescription}
              descriptionPlaceholder={itemDescriptionPlaceholder}
              onDescriptionChange={(value) => onItemDescriptionChange?.(item.id, value)}
              disabled={disabled}
            />
          )) : (
            <div className="knowledge-file-list__empty t-ui-plain">{emptyLabel}</div>
          )}
        </div>
      </section>

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </>
  );
};

export default KnowledgeFileList;
