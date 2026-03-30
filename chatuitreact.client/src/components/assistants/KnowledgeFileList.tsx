import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileProcessingService } from '../../services/fileProcessingService';
import type { CreateChatFileDto } from '../../types/chatModels';
import FilePreviewModal from '../chat/FilePreviewModal';
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
  onFilesSelected: (files: File[]) => void;
  items?: KnowledgeFileItemData[];
  disabled?: boolean;
  allowItemDescription?: boolean;
  itemDescriptionPlaceholder?: string;
  onItemDescriptionChange?: (itemId: string, description: string) => void;
}

const KnowledgeFileList = ({
  category,
  title,
  description,
  emptyLabel,
  onFilesSelected,
  items = [],
  disabled = false,
  allowItemDescription = false,
  itemDescriptionPlaceholder = '',
  onItemDescriptionChange
}: KnowledgeFileListProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<CreateChatFileDto | null>(null);

  const handleAddClick = () => {
    if (disabled) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }

    event.target.value = '';
  };

  const handlePreview = async (item: KnowledgeFileItemData) => {
    if (!item.file) {
      return;
    }

    try {
      const processedFile = await FileProcessingService.processFile(item.file);
      setPreviewFile(processedFile);
    } catch (error) {
      console.error('Failed to preview file:', error);
    }
  };

  return (
    <>
      <section className="knowledge-file-list" aria-label={title}>
        <div className="knowledge-file-list__header">
          <div className="knowledge-file-list__heading">
            <h3 className="knowledge-file-list__title">{title}</h3>
            <p className="knowledge-file-list__description">{description}</p>
          </div>

          <button
            type="button"
            className="knowledge-file-list__add-button"
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
          accept=".txt,.csv,.json,image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="knowledge-file-list__items">
          {items.length > 0 ? items.map((item) => (
            <KnowledgeFileItem
              key={item.id}
              item={item}
              category={category}
              onPreview={item.file ? () => void handlePreview(item) : undefined}
              allowDescription={allowItemDescription}
              descriptionPlaceholder={itemDescriptionPlaceholder}
              onDescriptionChange={(value) => onItemDescriptionChange?.(item.id, value)}
              disabled={disabled}
            />
          )) : (
            <div className="knowledge-file-list__empty">{emptyLabel}</div>
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