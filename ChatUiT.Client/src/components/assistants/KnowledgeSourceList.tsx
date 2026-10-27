import { useTranslation } from 'react-i18next';
import type { KnowledgeSourceDto } from '../../types/assistantModels';
import './KnowledgeFileList.css';

interface KnowledgeSourceListProps {
  /** The sources this user may use, from the server catalog. */
  sources: KnowledgeSourceDto[];
  selectedIds: string[];
  onToggle: (id: string, enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Knowledge the server loads each time a message is sent. Sources come from the catalog and
 * are grouped by their group heading, so a new source needs no change here.
 */
const KnowledgeSourceList = ({ sources, selectedIds, onToggle, disabled = false }: KnowledgeSourceListProps) => {
  const { t } = useTranslation();
  const title = t('assistants.knowledge.sources.title');

  const groups = new Map<string, KnowledgeSourceDto[]>();
  sources.forEach((source) => groups.set(source.group, [...(groups.get(source.group) ?? []), source]));
  const unknownIds = selectedIds.filter((id) => !sources.some((source) => source.id === id));

  return (
    <section className="knowledge-file-list" aria-label={title}>
      <div className="knowledge-file-list__header">
        <div className="knowledge-file-list__heading">
          <h3 className="knowledge-file-list__title t-body-strong">{title}</h3>
          <p className="knowledge-file-list__description t-ui-plain">{t('assistants.knowledge.sources.description')}</p>
        </div>
      </div>

      <div className="knowledge-file-list__items">
        {sources.length === 0 && unknownIds.length === 0 && (
          <div className="knowledge-file-list__empty t-ui-plain">{t('assistants.knowledge.sources.none')}</div>
        )}
        {[...groups].map(([group, groupSources]) => (
          <div key={group} className="af-tools">
            <span className="t-table-strong">{group}</span>
            {groupSources.map((source) => (
              <label key={source.id} className="af-checkbox-label af-tool t-table">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(source.id)}
                  onChange={(e) => onToggle(source.id, e.target.checked)}
                  disabled={disabled}
                />
                <span>
                  <span className="af-tool-name t-table-strong">{source.displayName}</span>
                  <span className="af-tool-description"> — {source.description}</span>
                </span>
              </label>
            ))}
          </div>
        ))}
        {unknownIds.length > 0 && (
          <div className="af-tools">
            {unknownIds.map((id) => (
              <label key={id} className="af-checkbox-label af-tool af-tool-unavailable t-table">
                <input type="checkbox" checked onChange={() => onToggle(id, false)} disabled={disabled} />
                <span>
                  <span className="af-tool-name t-table-strong">{id}</span>
                  <span className="af-tool-description"> — {t('assistants.knowledge.sources.unavailable')}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default KnowledgeSourceList;
