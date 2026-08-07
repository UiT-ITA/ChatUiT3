import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { MdImage, MdPublic, MdPsychology, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import './AssistantsPage.css';
import { getAssistants, deleteAssistant, toggleVisibility, addSharedAssistant, invalidateAssistants, removeSharedAssistant } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import { setUserSelectedAssistantId } from '../../services/chatService';
import type { FullAssistantDto, AssistantSummaryDto } from '../../types/assistantModels';
import AssistantForm from './AssistantForm';
import AddExternalAssistant from './AddExternalAssistant';
import ShareModal from './ShareModal';
import TagField from '../common/TagField';

type AssistantVariant = 'owned' | 'system' | 'shared';

const AssistantsPage: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const { assistantId } = useParams<{ assistantId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const assistantList = getAssistants();
  const models = getModels().value ?? [];
  const [shareModalAssistant, setShareModalAssistant] = useState<FullAssistantDto | null>(null);

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

  const handleDeleteAssistant = async (id: string) => {
    if (!window.confirm(t('assistants.deleteConfirmation'))) return;

    try {
      await deleteAssistant(id);
      navigate('/assistants');
    } catch (error) {
      console.error('Failed to delete assistant:', error);
    }
  };

  const handleRemoveSharedAssistant = async (id: string) => {
    if (!window.confirm(t('assistants.deleteConfirmation'))) return;

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

  const { owned, system, shared } = assistantList.value;

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

    const headerActions = (
      <div className="assistant-detail-actions">
        <button
          className="assistant-action-button t-ui"
          onClick={() => handleToggleVisibility(assistant.id)}
          title={assistant.isVisible ? t('assistants.actions.hideFromSelector') : t('assistants.actions.showInSelector')}
        >
          {assistant.isVisible ? <MdVisibility size="1.125rem" /> : <MdVisibilityOff size="1.125rem" />}
          {assistant.isVisible ? t('assistants.actions.hideFromSelector') : t('assistants.actions.showInSelector')}
        </button>
        <button
          className="assistant-action-button t-ui"
          onClick={() => handleUseInChat(assistant.id)}
        >
          {t('assistants.useInNewChat')}
        </button>
        {variant === 'owned' && (
          <>
            <button
              className="assistant-action-button t-ui"
              onClick={() => setShareModalAssistant(assistant as FullAssistantDto)}
            >
              {t('assistants.actions.shareAssistant')}
            </button>
            <button
              className="assistant-action-button danger t-ui"
              onClick={() => handleDeleteAssistant(assistant.id)}
            >
              {t('assistants.actions.deleteAssistant')}
            </button>
          </>
        )}
        {variant === 'shared' && (
          <button
            className="assistant-action-button danger t-ui"
            onClick={() => handleRemoveSharedAssistant(assistant.id)}
          >
            {t('common.delete')}
          </button>
        )}
      </div>
    );

    return (
      <div className="assistants-page">
        <div className="assistants-page-content">
          <h1 className="t-page-title">{assistant.name}</h1>
          <div className="page-title-bar" />
          {headerActions}

          {variant === 'owned' ? (
            <AssistantForm
              key={assistant.id}
              editingAssistant={assistant as FullAssistantDto}
              saveLabel={t('assistants.saveAssistant')}
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
                  {model?.capabilities.vision && <span className="af-capability-icon" title={t('assistants.capabilities.vision')}><MdImage size="1rem" /></span>}
                  {model?.capabilities.tools && <span className="af-capability-icon" title={t('assistants.capabilities.tools')}><MdPublic size="1rem" /></span>}
                  {(model?.capabilities.supportedEfforts.length ?? 0) > 0 && <span className="af-capability-icon" title={t('assistants.capabilities.reasoning')}><MdPsychology size="1rem" /></span>}
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
      </div>
    );
  }

  // ---- Overview (no assistant selected) ----
  const renderOverviewGroup = (
    title: string,
    assistants: (FullAssistantDto | AssistantSummaryDto)[],
    emptyKey: string
  ) => (
    <div className="assistants-overview-group">
      <div className="t-overline">{title}</div>
      {assistants.length > 0 ? (
        <div className="assistants-overview-list">
          {assistants.map((assistant) => {
            const model = models.find(m => m.id === assistant.modelId);
            return (
              <button
                key={assistant.id}
                className="assistants-overview-row"
                onClick={() => navigate(`/assistants/${assistant.id}`)}
              >
                <span className="assistants-overview-name t-table-strong">{assistant.name}</span>
                <span className="assistants-overview-desc t-caption">{assistant.description || ''}</span>
                <span className="assistants-overview-model t-meta">{model?.modelName || ''}</span>
                {!assistant.isVisible && (
                  <span className="assistants-overview-hidden" title={t('assistants.actions.showInSelector')}>
                    <MdVisibilityOff size="1rem" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
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
          <button onClick={() => navigate('/assistants/new')} className="create-assistant-button t-ui">
            {t('assistants.create')}
          </button>
        </div>
        <p className="assistants-intro t-body-lg">{t('assistants.intro')}</p>

        {renderOverviewGroup(t('assistants.myAssistants'), owned, 'assistants.emptyStates.noPersonalAssistants')}
        {renderOverviewGroup(t('assistants.systemAssistants'), system, 'assistants.emptyStates.noSystemAssistants')}
        {renderOverviewGroup(t('assistants.sharedAssistants'), shared, 'assistants.emptyStates.noSharedAssistants')}

        <AddExternalAssistant />
      </div>
    </div>
  );
};

export default AssistantsPage;
