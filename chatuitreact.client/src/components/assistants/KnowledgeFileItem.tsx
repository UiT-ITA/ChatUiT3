import { MdInsertDriveFile } from 'react-icons/md';
import './KnowledgeFileItem.css';

export type KnowledgeFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

export interface KnowledgeFileItemData {
  id: string;
  name: string;
  description?: string;
  file?: File;
}

interface KnowledgeFileItemProps {
  item: KnowledgeFileItemData;
  category: KnowledgeFileCategory;
  onPreview?: () => void;
  allowDescription?: boolean;
  descriptionPlaceholder?: string;
  onDescriptionChange?: (description: string) => void;
  disabled?: boolean;
}

const KnowledgeFileItem = ({
  item,
  category,
  onPreview,
  allowDescription = false,
  descriptionPlaceholder = '',
  onDescriptionChange,
  disabled = false
}: KnowledgeFileItemProps) => {
  return (
    <article className={[
      'knowledge-file-item',
      `knowledge-file-item--${category}`
    ].join(' ')}>
      <div className="knowledge-file-item__content">
        <button
          type="button"
          className="knowledge-file-item__preview"
          onClick={onPreview}
          disabled={disabled || !onPreview}
        >
          <div className="knowledge-file-item__icon" aria-hidden="true">
            <MdInsertDriveFile size={16} />
          </div>

          <div className="knowledge-file-item__name">
            {item.name}
          </div>
        </button>

        {allowDescription && (
          <input
            type="text"
            value={item.description ?? ''}
            onChange={(event) => onDescriptionChange?.(event.target.value)}
            className="knowledge-file-item__description-input"
            placeholder={descriptionPlaceholder}
            disabled={disabled}
          />
        )}
      </div>
    </article>
  );
};

export default KnowledgeFileItem;