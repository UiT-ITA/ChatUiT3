import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MdAdd } from 'react-icons/md';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import './AssistantsPage.css';
import { setAssistantSidebar, clearSidebarContent } from '../../services/sidebarService';
import { getAssistants, deleteAssistant, toggleVisibility, addSharedAssistant, invalidateAssistants } from '../../services/assistantService';
import type { PrivateAssistantDto } from '../../types/assistantModels';
import AssistantCard from './AssistantCard';
import AddExternalAssistant from './AddExternalAssistant';
import ShareModal from './ShareModal';
import AssistantModal from './AssistantModal';

const AssistantsPage: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const { assistantId } = useParams<{ assistantId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const assistantList = getAssistants();
  const [shareModalAssistant, setShareModalAssistant] = useState<PrivateAssistantDto | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState<PrivateAssistantDto | null>(null);

  const isListView = assistantId === undefined;

  useEffect(() => {
    setAssistantSidebar();
    return () => {
      clearSidebarContent();
    };
  }, []);

  // Handle shared assistant URL parameter
  useEffect(() => {
    const addAssistantId = searchParams.get('add');
    if (addAssistantId) {
      const handleAddFromUrl = async () => {
        try {
          await addSharedAssistant(addAssistantId);
          
          // Manually refresh the assistants list to ensure UI updates
          await invalidateAssistants();
          
          // Clear the URL parameter after processing
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

  const handleShareAssistant = (assistant: PrivateAssistantDto) => {
    setShareModalAssistant(assistant);
  };

  const handleEditAssistant = (assistant: PrivateAssistantDto) => {
    setEditingAssistant(assistant);
  };

  const handleDeleteAssistant = async (id: string) => {
    if (!window.confirm(t('assistants.deleteConfirmation'))) return;
    
    try {
      await deleteAssistant(id);
    } catch (error) {
      console.error('Failed to delete assistant:', error);
    }
  };

  const handleCreateAssistant = () => {
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingAssistant(null);
  };

  const handleCopyLink = (assistantId: string) => {
    const shareUrl = `${window.location.origin}/assistants?add=${assistantId}`;
    navigator.clipboard.writeText(shareUrl);
  };

  const handleCopyGuid = (assistantId: string) => {
    navigator.clipboard.writeText(assistantId);
  };

  if (isListView) {
    if (assistantList.value === undefined) {
      return <div>{t('common.loading')}</div>;
    }

    const { owned, system, shared } = assistantList.value;

    return (
      <div className="assistants-page">
        <div className="assistants-page-content">
          <div className="assistants-header">
            <h1 className="assistants-title">{t('assistants.title')}</h1>
            <button onClick={handleCreateAssistant} className="create-assistant-button">
              <MdAdd size={20} />
              {t('assistants.create')}
            </button>
          </div>

          <AddExternalAssistant />

          <div className="assistants-section">
            <h2 className="assistants-section-title">{t('assistants.myAssistants')}</h2>
            <div className="assistants-grid">
              {owned.length > 0 ? (
                owned.map(assistant => (
                  <AssistantCard
                    key={assistant.id}
                    assistant={assistant}
                    variant="owned"
                    onToggleFavorite={handleToggleVisibility}
                    onShare={handleShareAssistant}
                    onEdit={handleEditAssistant}
                    onDelete={handleDeleteAssistant}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state-title">{t('assistants.emptyStates.noPersonalAssistants')}</div>
                  <div className="empty-state-description">{t('assistants.emptyStates.createFirstAssistant')}</div>
                </div>
              )}
            </div>
          </div>

          <div className="assistants-section">
            <h2 className="assistants-section-title">{t('assistants.systemAssistants')}</h2>
            <div className="assistants-grid">
              {system.map((assistant, index) => (
                <AssistantCard
                  key={assistant.id}
                  assistant={assistant}
                  variant="system"
                  isDefault={index === 0}
                  onToggleFavorite={handleToggleVisibility}
                />
              ))}
            </div>
          </div>

          <div className="assistants-section">
            <h2 className="assistants-section-title">{t('assistants.sharedAssistants')}</h2>
            <div className="assistants-grid">
              {shared.length > 0 ? (
                shared.map(assistant => (
                  <AssistantCard
                    key={assistant.id}
                    assistant={assistant}
                    variant="shared"
                    onToggleFavorite={handleToggleVisibility}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state-title">{t('assistants.emptyStates.noSharedAssistants')}</div>
                  <div className="empty-state-description">{t('assistants.emptyStates.addSharedAssistants')}</div>
                </div>
              )}
            </div>
          </div>

          <AssistantModal
            isOpen={showCreateModal || editingAssistant !== null}
            editingAssistant={editingAssistant}
            onClose={handleCloseModal}
          />
          
          <ShareModal
            isOpen={shareModalAssistant !== null}
            assistant={shareModalAssistant}
            onClose={() => setShareModalAssistant(null)}
            onCopyLink={handleCopyLink}
            onCopyGuid={handleCopyGuid}
          />
        </div>
      </div>
    );
  }
};

export default AssistantsPage;
