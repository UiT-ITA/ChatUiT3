import KnowledgeFileItem, {
  type KnowledgeFileCategory,
  type KnowledgeFileItemData
} from './KnowledgeFileItem';
import './KnowledgeFileList.css';

export type { KnowledgeFileCategory } from './KnowledgeFileItem';

interface KnowledgeFileListProps {
  category: KnowledgeFileCategory;
  title: string;
  description: string;
  emptyLabel: string;
  items?: KnowledgeFileItemData[];
}

const KnowledgeFileList = ({
  category,
  title,
  description,
  emptyLabel,
  items = []
}: KnowledgeFileListProps) => {
  return (
    <section className="knowledge-file-list" aria-label={title}>
      <h3 className="knowledge-file-list__title">{title}</h3>
      <p className="knowledge-file-list__description">{description}</p>

      <div className="knowledge-file-list__items">
        {items.length > 0 ? items.map((item) => (
          <KnowledgeFileItem
            key={item.id}
            item={item}
            category={category}
          />
        )) : (
          <div className="knowledge-file-list__empty">{emptyLabel}</div>
        )}
      </div>
    </section>
  );
};

export default KnowledgeFileList;