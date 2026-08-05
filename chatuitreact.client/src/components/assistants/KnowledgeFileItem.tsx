import { MdInsertDriveFile } from 'react-icons/md';
import { Icon } from '../common/Icon';
import type { ChatFile } from '../../types/fileModels';
import './KnowledgeFileItem.css';

export type KnowledgeFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

export interface KnowledgeFileItemData {
  id: string;
  name: string;
  description?: string;
  ChatFile?: ChatFile;
  // Set for files that are already stored on the server; their content is
  // fetched on demand.
  fileId?: string;
}

interface KnowledgeFileItemProps {
  item: KnowledgeFileItemData;
  category: KnowledgeFileCategory;
  onPreview?: () => void;
  onRemove?: () => void;
  allowDescription?: boolean;
  descriptionPlaceholder?: string;
  onDescriptionChange?: (description: string) => void;
  disabled?: boolean;
}

const KnowledgeFileItem = ({
  item,
  category,
  onPreview,
  onRemove,
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

          <div className="knowledge-file-item__name t-body-strong">
            {item.name}
          </div>
        </button>

        {allowDescription && (
          <input
            type="text"
            value={item.description ?? ''}
            onChange={(event) => onDescriptionChange?.(event.target.value)}
            className="knowledge-file-item__description-input t-ui-plain"
            placeholder={descriptionPlaceholder}
            disabled={disabled}
          />
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          className="knowledge-file-item__remove"
          onClick={onRemove}
          disabled={disabled}
          title="Remove file"
        >
          <Icon name="trash" size={1} />
        </button>
      )}
    </article>
  );
};

export default KnowledgeFileItem;
