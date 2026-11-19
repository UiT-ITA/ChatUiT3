import { useTranslation } from 'react-i18next';
import type { KnowledgeSourceDto } from '../../types/assistantModels';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import PanelSection from '../common/PanelSection';
import UnavailableOption from './UnavailableOption';
import Stack from '../common/Stack';
import Text from '../common/Text';

interface KnowledgeSourceListProps {
  /** The sources this user may use, from the server catalog. */
  sources: KnowledgeSourceDto[];
  /** The checked source ids, in the order the sources are listed. */
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

/**
 * Knowledge the server loads each time a message is sent. Sources come from the catalog and
 * are grouped by their group heading, so a new source needs no change here.
 */
const KnowledgeSourceList = ({ sources, value, onChange, disabled = false }: KnowledgeSourceListProps) => {
  const { t } = useTranslation();
  const title = t('assistants.knowledge.sources.title');

  const groups = new Map<string, KnowledgeSourceDto[]>();
  sources.forEach((source) => groups.set(source.group, [...(groups.get(source.group) ?? []), source]));
  const unknownIds = value.filter((id) => !sources.some((source) => source.id === id));

  return (
    <PanelSection aria-label={title} title={title} description={t('assistants.knowledge.sources.description')}>
      {sources.length === 0 && unknownIds.length === 0 && (
        <Text as="div" variant="ui-plain" tone="muted" leading="base">{t('assistants.knowledge.sources.none')}</Text>
      )}
      <CheckboxGroup aria-label={title} value={value} onChange={onChange}>
        {[...groups].map(([group, groupSources]) => (
          <Stack key={group} gap="md" mt="sm">
            <Text as="span" variant="table-strong">{group}</Text>
            {groupSources.map((source) => (
              <Checkbox key={source.id} value={source.id} disabled={disabled}>
                <span>
                  <Text variant="table-strong">{source.displayName}</Text>
                  <Text tone="muted"> — {source.description}</Text>
                </span>
              </Checkbox>
            ))}
          </Stack>
        ))}
        {unknownIds.map((id) => (
          <UnavailableOption key={id} id={id} note={t('assistants.knowledge.sources.unavailable')} value={id} disabled={disabled} mt="sm" />
        ))}
      </CheckboxGroup>
    </PanelSection>
  );
};

export default KnowledgeSourceList;
