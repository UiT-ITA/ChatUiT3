import { MdInsertDriveFile } from 'react-icons/md';
import './KnowledgeFileItem.css';

export type KnowledgeFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

export interface KnowledgeFileItemData {
  id: string;
  name: string;
}

interface KnowledgeFileItemProps {
  item: KnowledgeFileItemData;
  category: KnowledgeFileCategory;
}

const KnowledgeFileItem = ({ item, category }: KnowledgeFileItemProps) => {
  return (
    <article className={[
      'knowledge-file-item',
      `knowledge-file-item--${category}`
    ].join(' ')}>
      <div className="knowledge-file-item__icon" aria-hidden="true">
        <MdInsertDriveFile size={16} />
      </div>
      <div className="knowledge-file-item__name">
        {item.name}
      </div>
    </article>
  );
};

export default KnowledgeFileItem;