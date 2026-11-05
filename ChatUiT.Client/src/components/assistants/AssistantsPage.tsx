import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { getAssistants, deleteAssistant, toggleFavorite, toggleVisibility, addSharedAssistant, invalidateAssistants, removeSharedAssistant, setDefaultAssistant, clearDefaultAssistant } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import { setUserSelectedAssistantId } from '../../services/chatService';
import type { AssistantDto, FullAssistantDto, AssistantSummaryDto } from '../../types/assistantModels';
import { ASSISTANT_SECTIONS } from './assistantSections';
import { capabilityKeys, distinctCapabilities } from './assistantCapabilities';
import AssistantCard, { DefaultBadge } from './AssistantCard';
import CapabilityTag from './CapabilityTag';
import { CardGrid } from '../common/CardGrid';
import Scroller from '../common/Scroller';
import PillButton from '../common/PillButton';
import AssistantForm from './AssistantForm';
import AssistantDeleteFooter from './AssistantDeleteFooter';
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
import PageTitleBar from '../common/PageTitleBar';
import Page, { PageIntro } from '../common/Page';
import Stack from '../common/Stack';
import Box from '../common/Box';
import Text from '../common/Text';
import ActionBar from '../common/ActionBar';
import EmptyNote from '../common/EmptyNote';

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

  // Adds the shared assistant in the `add` URL parameter
  useEffect(() => {
    const addAssistantId = searchParams.get('add');
    if (!addAssistantId) return;
    addSharedAssistant(addAssistantId)
      .then(() => invalidateAssistants())
      .then(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('add');
        setSearchParams(newSearchParams, { replace: true });
      })
      .catch(error => console.error('Failed to add shared assistant from URL:', error));
  }, [searchParams, setSearchParams]);

  const handleToggleVisibility = (id: string) =>
    toggleVisibility(id).catch(error => console.error('Failed to toggle visibility:', error));

  // No refetch: the service updates the list optimistically and reverts on failure.
  const handleToggleDefault = (id: string, isDefault: boolean) =>
    (isDefault ? clearDefaultAssistant() : setDefaultAssistant(id)).catch(error => console.error('Failed to change default assistant:', error));

  const handleRemove = async ({ id, shared }: { id: string; shared: boolean }) => {
    setPendingRemoval(null);
    try {
      if (shared) {
        await removeSharedAssistant(id);
        await invalidateAssistants();
      } else {
        await deleteAssistant(id);
      }
      navigate('/assistants');
    } catch (error) {
      console.error(shared ? 'Failed to remove shared assistant:' : 'Failed to delete assistant:', error);
    }
  };

  if (assistantList.value === undefined) {
    return <Page>{t('common.loading')}</Page>;
  }

  const list = assistantList.value;
  const { defaultAssistantId } = list;

  // ---- New assistant ----
  if (isNew) {
    return (
      <Page>
        <Text as="h1" variant="page-title">{t('assistants.newAssistant')}</Text>
        <PageTitleBar />
        <PageIntro>{t('assistants.intro')}</PageIntro>
        <AssistantForm
          editingAssistant={null}
          onSaved={() => navigate('/assistants')}
          saveLabel={t('assistants.saveAssistant')}
          backPath="/assistants"
          backLabel={t('contextColumn.assistants')}
        />
      </Page>
    );
  }

  // ---- Assistant detail ----
  if (assistantId !== undefined) {
    const variant = ASSISTANT_SECTIONS.map(({ type }) => type).find(type => list[type].some(a => a.id === assistantId));
    const assistant = variant && list[variant].find(a => a.id === assistantId);

    if (!variant || !assistant) {
      return (
        <Page>
          <Text as="h1" variant="page-title">{t('assistants.title')}</Text>
          <PageTitleBar />
          <PageIntro>{t('assistants.notFound')}</PageIntro>
        </Page>
      );
    }

    const model = models.find(m => m.id === assistant.modelId);
    const isDefault = defaultAssistantId === assistant.id;
    // A pin stays stored when its model stops being default-eligible, so say so rather than
    // letting the user wonder why new chats no longer start here.
    const isDefaultInactive = isDefault && !assistant.canBeDefault;

    const headerActions = (
      <ActionBar
        divided
        fillOnMobile
        mt="sm"
        mb="xl"
      >
        <Button
          variant="primary"
          size="medium"
          startIcon="chatNew"
          onClick={() => {
            setUserSelectedAssistantId(assistant.id);
            navigate('/chat/new');
          }}
          title={t('assistants.useInNewChat')}
        >
          {t('assistants.useInNewChat')}
        </Button>
        <Button
          variant="subtle"
          size="medium"
          startIcon={assistant.isVisible ? 'hidden' : 'visible'}
          onClick={() => handleToggleVisibility(assistant.id)}
          title={assistant.isVisible ? t('assistants.actions.hideFromSelector') : t('assistants.actions.showInSelector')}
        >
          {assistant.isVisible ? t('assistants.actions.hideFromSelector') : t('assistants.actions.showInSelector')}
        </Button>
        <Button
          variant="subtle"
          size="medium"
          startIcon={isDefault ? 'checkCircle' : 'check'}
          active={isDefault}
          aria-pressed={isDefault}
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
        {variant === 'owned' && (
          <Button
            variant="subtle"
            size="medium"
            startIcon="people"
            onClick={() => setShareModalAssistant(assistant as FullAssistantDto)}
            title={t('assistants.actions.shareAssistant')}
          >
            {t('assistants.actions.shareAssistant')}
          </Button>
        )}
      </ActionBar>
    );

    return (
      <Page>
        <Text as="h1" variant="page-title">{assistant.name}</Text>
        <PageTitleBar />
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
          <>
            {assistant.description && (
              <PageIntro>{assistant.description}</PageIntro>
            )}

            {assistant.tags.length > 0 && (
              <Box mb="xl">
                <Text as="div" variant="overline" block mb="sm">{t('assistants.form.tags')}</Text>
                <TagField tags={assistant.tags} readonly={true} />
              </Box>
            )}

            <Box mb="xl">
              <Text as="div" variant="overline" block mb="sm">{t('assistants.form.model')}</Text>
              <Stack direction="row" align="center" gap="sm">
                <Text variant="body-strong" tone="default">{model?.modelName || '—'}</Text>
                {capabilityKeys(assistant, models).map(key => (
                  <CapabilityTag key={key} capability={key} iconOnly />
                ))}
              </Stack>
              {model?.description && <Text as="div" variant="caption" tone="muted" mt="xs">{model.description}</Text>}
            </Box>

            {(assistant as AssistantSummaryDto).createdBy && (
              <Box mb="xl">
                <Text as="div" variant="overline" block mb="sm">{t('assistants.createdBy')}</Text>
                <Text as="div" variant="caption" tone="muted" mt="xs">{(assistant as AssistantSummaryDto).createdBy}</Text>
              </Box>
            )}
          </>
        )}

        {variant !== 'system' && (
          <AssistantDeleteFooter onDelete={() => setPendingRemoval({ id: assistant.id, shared: variant === 'shared' })} />
        )}

        <ShareModal assistant={shareModalAssistant} onClose={() => setShareModalAssistant(null)} />

        <ConfirmDialog
          isOpen={pendingRemoval !== null}
          title={pendingRemoval?.shared ? t('assistants.removeShared.title') : t('assistants.actions.deleteAssistant')}
          message={pendingRemoval?.shared ? t('assistants.removeShared.confirm') : t('assistants.deleteConfirmation')}
          confirmLabel={pendingRemoval?.shared ? t('assistants.removeShared.button') : t('common.delete')}
          onConfirm={() => { if (pendingRemoval) void handleRemove(pendingRemoval); }}
          onCancel={() => setPendingRemoval(null)}
        />
      </Page>
    );
  }

  // ---- Overview (no assistant selected) ----
  const capabilitiesOf = distinctCapabilities(list, models);

  const renderOverviewGroup = (
    title: string,
    assistants: (FullAssistantDto | AssistantSummaryDto)[],
    type: AssistantVariant,
    emptyKey: string
  ) => (
    <Box key={type} mb="2xl">
      <Text as="div" id={`assistants-overview-${type}`} variant="overline" block mb="md" scrollMarginTop="lg">{title}</Text>
      {assistants.length > 0 && settings.assistantView === 'cards' && (
        <CardGrid cardRows={3}>
          {assistants.map((assistant) => (
            <AssistantCard
              key={assistant.id}
              assistant={{ ...assistant, type } as AssistantDto}
              selected={false}
              isDefault={defaultAssistantId === assistant.id}
              hidden={!assistant.isVisible}
              showType={false}
              modelName={models.find(m => m.id === assistant.modelId)?.modelName}
              fileCount={type === 'owned' ? ((assistant as FullAssistantDto).files ?? []).length : 0}
              capabilities={capabilitiesOf(assistant)}
              onSelect={a => navigate(`/assistants/${a.id}`)}
              onToggleFavorite={a => void toggleFavorite(a.id)}
            />
          ))}
        </CardGrid>
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
                    {defaultAssistantId === assistant.id && <DefaultBadge canBeDefault={assistant.canBeDefault} />}
                    {!assistant.isVisible && <Icon name="hidden" color="muted" label={t('assistants.actions.showInSelector')} />}
                  </>
                )}
              />
            );
          })}
        </List>
      )}
      {assistants.length === 0 && (
        <EmptyNote>{t(emptyKey)}</EmptyNote>
      )}
    </Box>
  );

  return (
    <Page width="wide">
      <Stack direction="row" justify="between" align="start" gap="lg" mb="lg">
        <div>
          <Text as="h1" variant="page-title">{t('assistants.title')}</Text>
          <PageTitleBar mb="none" />
        </div>
        <Stack direction="row" wrap align="center" justify="end" gap="md">
          <SegmentedControl
            label={t('assistants.view.label')}
            size="small"
            value={settings.assistantView}
            onChange={view => void updateSetting('assistantView', view)}
            options={[
              { value: 'cards', label: t('assistants.view.cards'), leading: <Icon name="grid" size="sm" /> },
              { value: 'list', label: t('assistants.view.list'), leading: <Icon name="menu" size="sm" /> },
            ]}
          />
          <Button variant="primary" onClick={() => navigate('/assistants/new')}>
            {t('assistants.create')}
          </Button>
        </Stack>
      </Stack>
      <PageIntro mb="lg">{t('assistants.intro')}</PageIntro>
      <Scroller as="nav" axis="x" snap gap="sm" align="center" grow={false} shrink={false} mb="2xl" aria-label={t('assistants.sectionLinks')}>
        <Text variant="caption" tone="muted" grow={false} shrink={false} aria-hidden="true">{t('assistants.jumpTo')}</Text>
        {ASSISTANT_SECTIONS.map(({ type, titleKey }) => (
          <PillButton
            key={type}
            count={list[type].length}
            endIcon="arrowDown"
            onClick={() => document.getElementById(`assistants-overview-${type}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {t(titleKey)}
          </PillButton>
        ))}
      </Scroller>

      {ASSISTANT_SECTIONS.map(({ type, titleKey, emptyKey }) => renderOverviewGroup(t(titleKey), list[type], type, emptyKey))}

      <AddExternalAssistant />
    </Page>
  );
};

export default AssistantsPage;
