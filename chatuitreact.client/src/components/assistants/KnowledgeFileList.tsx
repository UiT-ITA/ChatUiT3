import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileProcessingService } from '../../services/fileProcessingService';
import type { ProcessedFile } from '../../types/importModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
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
  onFilesSelected: (files: ProcessedFile[]) => void;
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
  const [previewFile, setPreviewFile] = useState<ProcessedFile | null>(null);

  const handleAddClick = () => {
    if (disabled) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      const processedFiles = await Promise.all(
        Array.from(files)
          .filter((file) => isValidFileType(file))
          .map((file) => FileProcessingService.processFile(file))
      );

      onFilesSelected(processedFiles);
    }

    event.target.value = '';
  };

  const handlePreview = async (item: KnowledgeFileItemData) => {
    if (!item.processedFile) {
      return;
    }

    setPreviewFile(item.processedFile);
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
              onPreview={item.processedFile ? () => void handlePreview(item) : undefined}
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