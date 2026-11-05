import { useTranslation } from 'react-i18next';
import type { KnowledgeSourceDto } from '../../types/assistantModels';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import PanelSection from '../common/PanelSection';
import Text from '../common/Text';

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
    <PanelSection aria-label={title} title={title} description={t('assistants.knowledge.sources.description')}>
      {sources.length === 0 && unknownIds.length === 0 && (
        <Text as="div" variant="ui-plain" tone="muted" leading="base">{t('assistants.knowledge.sources.none')}</Text>
      )}
      {[...groups].map(([group, groupSources]) => (
        <CheckboxGroup key={group} mt="sm">
          <Text as="span" variant="table-strong">{group}</Text>
          {groupSources.map((source) => (
            <Checkbox
              key={source.id}
              checked={selectedIds.includes(source.id)}
              onChange={(checked) => onToggle(source.id, checked)}
              disabled={disabled}
            >
              <span>
                <Text variant="table-strong">{source.displayName}</Text>
                <Text tone="muted"> — {source.description}</Text>
              </span>
            </Checkbox>
          ))}
        </CheckboxGroup>
      ))}
      {unknownIds.length > 0 && (
        <CheckboxGroup mt="sm">
          {unknownIds.map((id) => (
            <Checkbox key={id} checked onChange={() => onToggle(id, false)} disabled={disabled}>
              <span>
                <Text variant="table-strong" tone="muted" strike>{id}</Text>
                <Text tone="muted"> — {t('assistants.knowledge.sources.unavailable')}</Text>
              </span>
            </Checkbox>
          ))}
        </CheckboxGroup>
      )}
    </PanelSection>
  );
};

export default KnowledgeSourceList;
