import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import './AssistantsPage.css';
import { getAssistants, deleteAssistant, toggleVisibility, addSharedAssistant, invalidateAssistants, removeSharedAssistant, setDefaultAssistant, clearDefaultAssistant } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import { setUserSelectedAssistantId } from '../../services/chatService';
import type { AssistantDto, FullAssistantDto, AssistantSummaryDto } from '../../types/assistantModels';
import AssistantCard from './AssistantCard';
import AssistantForm from './AssistantForm';
import AddExternalAssistant from './AddExternalAssistant';
import ShareModal from './ShareModal';
import TagField from '../common/TagField';
import Button from '../common/Button';
import { FieldDescription } from '../common/Field';
import { List, ListItem } from '../common/List';
import { Icon } from '../common/Icon';
import { ConfirmDialog } from '../common/Dialog';
import SegmentedControl from '../common/SegmentedControl';
import { useSettings } from '../../hooks/useSettings';

type AssistantVariant = AssistantDto['type'];

const AssistantsPage: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const { assistantId } = useParams<{ assistantId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const assistantList = getAssistants();
  const models = getModels().value ?? [];
  const { settings, updateSetting } = useSettings();
  const [shareModalAssistant, setShareModalAssistant] = useState<FullAssistantDto | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; shared: boolean } | null>(null);
  const [shownId, setShownId] = useState(assistantId);
  if (assistantId !== shownId) {
    setShownId(assistantId);
    setPendingRemoval(null);
  }

  const isNew = assistantId === 'new';

  // Handle shared assistant URL parameter
  useEffect(() => {
    const addAssistantId = searchParams.get('add');
    if (addAssistantId) {
      const handleAddFromUrl = async () => {
        try {
          await addSharedAssistant(addAssistantId);
          await invalidateAssistants();
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('add');
          setSearchParams(newSearchParams, { replace: true });
        } catch (error) {
          console.error('Failed to add shared assistant from URL:', error);
        }
      };

      handleAddFromUrl();
    }
  }, [searchParams, setSearchParams]);

  const handleToggleVisibility = async (id: string) => {
    try {
      await toggleVisibility(id);
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  // No refetch: the service updates the list optimistically and reverts on failure.
  const handleToggleDefault = async (id: string, isDefault: boolean) => {
    try {
      if (isDefault) {
        await clearDefaultAssistant();
      } else {
        await setDefaultAssistant(id);
      }
    } catch (error) {
      console.error('Failed to change default assistant:', error);
    }
  };

  const handleDeleteAssistant = async (id: string) => {
    setPendingRemoval(null);
    try {
      await deleteAssistant(id);
      navigate('/assistants');
    } catch (error) {
      console.error('Failed to delete assistant:', error);
    }
  };

  const handleRemoveSharedAssistant = async (id: string) => {
    setPendingRemoval(null);
    try {
      await removeSharedAssistant(id);
      await invalidateAssistants();
      navigate('/assistants');
    } catch (error) {
      console.error('Failed to remove shared assistant:', error);
    }
  };

  const handleUseInChat = (id: string) => {
    setUserSelectedAssistantId(id);
    navigate('/chat/new');
  };

  const handleCopyLink = (id: string) => {
    const shareUrl = `${window.location.origin}/assistants?add=${id}`;
    navigator.clipboard.writeText(shareUrl);
  };

  const handleCopyGuid = (id: string) => {
    navigator.clipboard.writeText(id);
  };

  if (assistantList.value === undefined) {
    return <div className="assistants-page"><div className="assistants-page-content">{t('common.loading')}</div></div>;
  }

  const { owned, system, shared, defaultAssistantId } = assistantList.value;

  const findAssistant = (): { assistant: FullAssistantDto | AssistantSummaryDto; variant: AssistantVariant } | undefined => {
    const ownedMatch = owned.find(a => a.id === assistantId);
    if (ownedMatch) return { assistant: ownedMatch, variant: 'owned' };
    const systemMatch = system.find(a => a.id === assistantId);
    if (systemMatch) return { assistant: systemMatch, variant: 'system' };
    const sharedMatch = shared.find(a => a.id === assistantId);
    if (sharedMatch) return { assistant: sharedMatch, variant: 'shared' };
    return undefined;
  };

  // ---- New assistant ----
  if (isNew) {
    return (
      <div className="assistants-page">
        <div className="assistants-page-content">
          <h1 className="t-page-title">{t('assistants.newAssistant')}</h1>
          <div className="page-title-bar" />
          <p className="assistants-intro t-body-lg">{t('assistants.intro')}</p>
          <AssistantForm
            editingAssistant={null}
            onSaved={() => navigate('/assistants')}
            saveLabel={t('assistants.saveAssistant')}
            backPath="/assistants"
            backLabel={t('contextColumn.assistants')}
          />
        </div>
      </div>
    );
  }

  // ---- Assistant detail ----
  if (assistantId !== undefined) {
    const found = findAssistant();

    if (!found) {
      return (
        <div className="assistants-page">
          <div className="assistants-page-content">
            <h1 className="t-page-title">{t('assistants.title')}</h1>
            <div className="page-title-bar" />
            <p className="assistants-intro t-body-lg">{t('assistants.notFound')}</p>
          </div>
        </div>
      );
    }

    const { assistant, variant } = found;
    const model = models.find(m => m.id === assistant.modelId);
    const isDefault = defaultAssistantId === assistant.id;
    // A pin stays stored when its model stops being default-eligible, so say so rather than
    // letting the user wonder why new chats no longer start here.
    const isDefaultInactive = isDefault && !assistant.canBeDefault;

    const headerActions = (
      <div className="assistant-detail-actions">
        <Button
          variant="subtle"
          size="small"
          startIcon={isDefault && assistant.canBeDefault ? 'pin' : 'pinOutline'}
          onClick={() => handleToggleDefault(assistant.id, isDefault)}
          disabled={!isDefault && !assistant.canBeDefault}
          title={
            isDefault
              ? t('assistants.actions.clearDefault')
              : assistant.canBeDefault
                ? t('assistants.actions.setAsDefault')
                : t('assistants.actions.cannotBeDefault')
          }
        >
          {isDefault ? t('assistants.actions.clearDefault') : t('assistants.actions.setAsDefault')}
        </Button>
        <Button
          variant="subtle"
          size="small"
          startIcon={assistant.isVisible ? 'visible' : 'hidden'}
          onClick={() => handleToggleVisibility(assistant.id)}
          title={assistant.isVisible ? t('assistants.actions.hideFromSelector') : t('assistants.actions.showInSelector')}
        >
          {assistant.isVisible ? t('assistants.actions.hideFromSelector') : t('assistants.actions.showInSelector')}
        </Button>
        <Button
          variant="subtle"
          size="small"
          onClick={() => handleUseInChat(assistant.id)}
        >
          {t('assistants.useInNewChat')}
        </Button>
        {variant === 'owned' && (
          <>
            <Button
              variant="subtle"
              size="small"
              onClick={() => setShareModalAssistant(assistant as FullAssistantDto)}
            >
              {t('assistants.actions.shareAssistant')}
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={() => setPendingRemoval({ id: assistant.id, shared: false })}
            >
              {t('assistants.actions.deleteAssistant')}
            </Button>
          </>
        )}
        {variant === 'shared' && (
          <Button
            variant="danger"
            size="small"
            onClick={() => setPendingRemoval({ id: assistant.id, shared: true })}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
    );

    return (
      <div className="assistants-page">
        <div className="assistants-page-content">
          <h1 className="t-page-title">{assistant.name}</h1>
          <div className="page-title-bar" />
          {headerActions}

          {isDefaultInactive && (
            <FieldDescription>{t('assistants.defaultInactiveNote')}</FieldDescription>
          )}

          {variant === 'owned' ? (
            <AssistantForm
              key={assistant.id}
              editingAssistant={assistant as FullAssistantDto}
              saveLabel={t('assistants.saveAssistant')}
              backPath="/assistants"
              backLabel={t('contextColumn.assistants')}
            />
          ) : (
            <div className="assistant-readonly">
              {assistant.description && (
                <p className="assistants-intro t-body-lg">{assistant.description}</p>
              )}

              {assistant.tags.length > 0 && (
                <div className="assistant-readonly-row">
                  <div className="t-overline">{t('assistants.form.tags')}</div>
                  <TagField tags={assistant.tags} readonly={true} />
                </div>
              )}

              <div className="assistant-readonly-row">
                <div className="t-overline">{t('assistants.form.model')}</div>
                <div className="assistant-readonly-model t-body">
                  <span className="assistant-readonly-model-name t-body-strong">{model?.modelName || '—'}</span>
                  {model?.capabilities.vision && <Icon name="image" color="accent" label={t('assistants.capabilities.vision')} />}
                  {model?.capabilities.tools && <Icon name="globe" color="accent" label={t('assistants.capabilities.tools')} />}
                  {(model?.capabilities.supportedEfforts.length ?? 0) > 0 && <Icon name="brain" color="accent" label={t('assistants.capabilities.reasoning')} />}
                </div>
                {model?.description && <div className="assistant-readonly-note t-caption">{model.description}</div>}
              </div>

              {(assistant as AssistantSummaryDto).createdBy && (
                <div className="assistant-readonly-row">
                  <div className="t-overline">{t('assistants.createdBy')}</div>
                  <div className="assistant-readonly-note t-caption">{(assistant as AssistantSummaryDto).createdBy}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <ShareModal
          isOpen={shareModalAssistant !== null}
          assistant={shareModalAssistant}
          onClose={() => setShareModalAssistant(null)}
          onCopyLink={handleCopyLink}
          onCopyGuid={handleCopyGuid}
        />

        <ConfirmDialog
          isOpen={pendingRemoval !== null}
          title={pendingRemoval?.shared ? t('assistants.removeShared.title') : t('assistants.actions.deleteAssistant')}
          message={pendingRemoval?.shared ? t('assistants.removeShared.confirm') : t('assistants.deleteConfirmation')}
          confirmLabel={pendingRemoval?.shared ? t('assistants.removeShared.button') : t('common.delete')}
          onConfirm={() => {
            if (!pendingRemoval) return;
            if (pendingRemoval.shared) handleRemoveSharedAssistant(pendingRemoval.id);
            else handleDeleteAssistant(pendingRemoval.id);
          }}
          onCancel={() => setPendingRemoval(null)}
        />
      </div>
    );
  }

  // ---- Overview (no assistant selected) ----
  const renderOverviewGroup = (
    title: string,
    assistants: (FullAssistantDto | AssistantSummaryDto)[],
    type: AssistantVariant,
    emptyKey: string
  ) => (
    <div className="assistants-overview-group">
      <div className="t-overline">{title}</div>
      {assistants.length > 0 && settings.assistantView === 'cards' && (
        <div className="assistant-card-grid">
          {assistants.map((assistant) => (
            <AssistantCard
              key={assistant.id}
              assistant={{ ...assistant, type } as AssistantDto}
              selected={false}
              isDefault={defaultAssistantId === assistant.id}
              hidden={!assistant.isVisible}
              onSelect={a => navigate(`/assistants/${a.id}`)}
            />
          ))}
        </div>
      )}
      {assistants.length > 0 && settings.assistantView === 'list' && (
        <List bordered>
          {assistants.map((assistant) => {
            const model = models.find(m => m.id === assistant.modelId);
            return (
              <ListItem
                key={assistant.id}
                onClick={() => navigate(`/assistants/${assistant.id}`)}
                title={assistant.name}
                description={assistant.description || undefined}
                trailing={(
                  <>
                    {model?.modelName}
                    {defaultAssistantId === assistant.id && (
                      <Icon
                        name={assistant.canBeDefault ? 'pin' : 'pinOutline'}
                        color="muted"
                        label={assistant.canBeDefault ? t('assistants.actions.isDefault') : t('assistants.defaultInactiveNote')}
                      />
                    )}
                    {!assistant.isVisible && <Icon name="hidden" color="muted" label={t('assistants.actions.showInSelector')} />}
                  </>
                )}
              />
            );
          })}
        </List>
      )}
      {assistants.length === 0 && (
        <div className="assistants-overview-empty t-ui-plain">{t(emptyKey)}</div>
      )}
    </div>
  );

  return (
    <div className="assistants-page">
      <div className="assistants-page-content">
        <div className="assistants-header">
          <div>
            <h1 className="t-page-title">{t('assistants.title')}</h1>
            <div className="page-title-bar" />
          </div>
          <div className="assistants-header-actions">
            <SegmentedControl
              label={t('assistants.view.label')}
              size="small"
              value={settings.assistantView}
              onChange={view => void updateSetting('assistantView', view)}
              options={[
                { value: 'cards', label: t('assistants.view.cards'), leading: <Icon name="grid" size="small" /> },
                { value: 'list', label: t('assistants.view.list'), leading: <Icon name="menu" size="small" /> },
              ]}
            />
            <Button variant="primary" onClick={() => navigate('/assistants/new')}>
              {t('assistants.create')}
            </Button>
          </div>
        </div>
        <p className="assistants-intro t-body-lg">{t('assistants.intro')}</p>

        {renderOverviewGroup(t('assistants.myAssistants'), owned, 'owned', 'assistants.emptyStates.noPersonalAssistants')}
        {renderOverviewGroup(t('assistants.systemAssistants'), system, 'system', 'assistants.emptyStates.noSystemAssistants')}
        {renderOverviewGroup(t('assistants.sharedAssistants'), shared, 'shared', 'assistants.emptyStates.noSharedAssistants')}

        <AddExternalAssistant />
      </div>
    </div>
  );
};

export default AssistantsPage;
