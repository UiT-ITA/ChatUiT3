import { Fragment } from 'react';
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { getAssistants } from "../../services/assistantService";
import { getModels } from "../../services/modelService";
import { useSignals } from "@preact/signals-react/runtime";
import { ASSISTANT_SECTIONS, type FullAssistantDto } from "../../types/assistantModels";
import NavItem from '../common/NavItem';
import { Icon } from '../common/Icon';
import ClassificationBadge from '../classification/ClassificationBadge';
import CapabilityTag from './CapabilityTag';
import { DefaultBadge } from './AssistantCard';
import { distinctCapabilities } from './assistantCapabilities';
import { useNavListStyle } from '../common/navListStyle';
import { cx } from '../common/layout';
import { SideColumnGroupLabel, SideColumnNote } from '../layout/AppShell';
import './AssistantList.css';

interface AssistantListProps {
  activeId?: string;
  onNavigate?: () => void;
}

export function AssistantList({ activeId, onNavigate }: AssistantListProps) {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const assistantList = getAssistants();
  const models = getModels().value ?? [];
  const { mobileList } = useNavListStyle();

  if (assistantList.value === undefined) {
    return <SideColumnNote>{t('common.loading')}</SideColumnNote>;
  }

  const list = assistantList.value;
  const capabilitiesOf = distinctCapabilities(list, models);

  return (
    <div>
      {ASSISTANT_SECTIONS.map(({ type, titleKey, emptyKey }) => (
        <Fragment key={type}>
          <SideColumnGroupLabel>{t(titleKey)}</SideColumnGroupLabel>
          {list[type].length === 0 && <SideColumnNote>{t(emptyKey)}</SideColumnNote>}
          {list[type].map((assistant) => {
            const fileCount = type === 'owned' ? ((assistant as FullAssistantDto).files ?? []).length : 0;
            const metaText = [
              models.find(m => m.id === assistant.modelId)?.modelName,
              fileCount > 0 ? t('assistants.fileCount', { count: fileCount }) : undefined
            ].filter(Boolean).join(' · ');
            return (
              <NavItem
                key={assistant.id}
                active={assistant.id === activeId}
                description={assistant.description || undefined}
                meta={(
                  <span className="assistant-list-meta">
                    {metaText && <span className="assistant-list-meta-text">{metaText}</span>}
                    {mobileList && <ClassificationBadge classification={assistant.classification} />}
                    {mobileList && capabilitiesOf(assistant).map(key => (
                      <CapabilityTag key={key} capability={key} />
                    ))}
                  </span>
                )}
                trailing={assistant.isFavorite ? (
                  <span className={cx('assistant-list-marks', mobileList && 'assistant-list-marks--spaced')}>
                    <Icon name="star" size="sm" color="accent" label={t('assistants.picker.categories.favorites')} />
                  </span>
                ) : undefined}
                onClick={() => {
                  navigate(`/assistants/${assistant.id}`);
                  onNavigate?.();
                }}
              >
                <span className="assistant-list-title">
                  <span className="assistant-list-name">{assistant.name}</span>
                  {list.defaultAssistantId === assistant.id && (
                    <DefaultBadge canBeDefault={assistant.canBeDefault} className="assistant-list-default" />
                  )}
                </span>
              </NavItem>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
