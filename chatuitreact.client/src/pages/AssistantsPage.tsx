import React, { useState, useEffect } from 'react';
import { MdAdd } from 'react-icons/md';
import { useSearchParams } from 'react-router-dom';
import { PrivateAssistantDto, CreateAssistantDto, UpdateAssistantDto, ReasoningEffort } from '../types/dtos';
import { useAssistants } from '../hooks/useAssistants';
import { useSignalR } from '../contexts/SignalRContext';

import { enhanceModelsWithCapabilities, EnhancedModel } from '../utils/modelUtils';
import AssistantCard from '../components/assistants/AssistantCard';
import AssistantModal from '../components/assistants/AssistantModal';
import ShareModal from '../components/assistants/ShareModal';
import AddExternalAssistant from '../components/assistants/AddExternalAssistant';
import './AssistantsPage.css';

const AssistantsPage: React.FC = () => {
  const { assistantList, createAssistant, updateAssistant, deleteAssistant, toggleVisibility, addSharedAssistant, getAvailableModels } = useAssistants();
  const { isConnected } = useSignalR();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingAssistantId, setPendingAssistantId] = useState<string | null>(null);

  const [models, setModels] = useState<EnhancedModel[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState<PrivateAssistantDto | null>(null);
  const [shareModalAssistant, setShareModalAssistant] = useState<PrivateAssistantDto | null>(null);

  const [formData, setFormData] = useState<CreateAssistantDto>({
    name: '',
    description: '',
    tags: [],
    modelId: '',
    systemPrompt: '',
    temperature: 0.7,
    reasoningEffort: ReasoningEffort.None
  });

  // Handle URL parameter for adding shared assistant
  useEffect(() => {
    const addId = searchParams.get('add');
    if (addId) {
      if (isConnected) {
        handleAddExternal(addId);
      } else {
        setPendingAssistantId(addId);
      }
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('add');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, isConnected]);

  // Process pending assistant add when connection becomes available
  useEffect(() => {
    if (isConnected && pendingAssistantId) {
      handleAddExternal(pendingAssistantId);
      setPendingAssistantId(null);
    }
  }, [isConnected, pendingAssistantId]);

  const loadModels = async () => {
    const rawModels = await getAvailableModels();
    const enhancedModels = enhanceModelsWithCapabilities(rawModels);
    setModels(enhancedModels);
  };

  const handleOpenCreateModal = async () => {
    await loadModels();
    setShowCreateModal(true);
  };

  const handleStartEdit = async (assistant: PrivateAssistantDto) => {
    await loadModels();
    setEditingAssistant(assistant);
    setFormData({
      name: assistant.name,
      description: assistant.description,
      tags: assistant.tags,
      modelId: assistant.model.id,
      systemPrompt: assistant.systemPrompt,
      temperature: assistant.temperature,
      reasoningEffort: assistant.reasoningEffort
    });
  };

  const handleCreateAssistant = async () => {
    await createAssistant(formData);
    setShowCreateModal(false);
    resetForm();
  };

  const handleUpdateAssistant = async () => {
    if (!editingAssistant) return;
    
    const updateData: UpdateAssistantDto = {
      id: editingAssistant.id,
      name: formData.name,
      description: formData.description,
      tags: formData.tags,
      modelId: formData.modelId,
      systemPrompt: formData.systemPrompt,
      temperature: formData.temperature,
      reasoningEffort: formData.reasoningEffort
    };

    await updateAssistant(updateData);
    setEditingAssistant(null);
    resetForm();
  };

  const handleDeleteAssistant = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this assistant?')) {
      await deleteAssistant(id);
    }
  };

  const handleToggleVisibility = async (id: string) => {
    await toggleVisibility(id);
  };

  const handleAddExternal = async (assistantId: string) => {
    if (!isConnected) {
      setPendingAssistantId(assistantId);
      return;
    }
    await addSharedAssistant(assistantId);
  };

  const handleShareAssistant = (assistant: PrivateAssistantDto) => {
    setShareModalAssistant(assistant);
  };

  const copyShareLink = (assistantId: string) => {
    const shareUrl = `${window.location.origin}/assistants?add=${assistantId}`;
    navigator.clipboard.writeText(shareUrl);
  };

  const copyGuid = (assistantId: string) => {
    navigator.clipboard.writeText(assistantId);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      tags: [],
      modelId: '',
      systemPrompt: '',
      temperature: 0.7,
      reasoningEffort: ReasoningEffort.None
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingAssistant(null);
    resetForm();
  };

  // Get assistants from the structured data, with null checks
  const ownedAssistants = assistantList?.owned || [];
  const systemAssistants = assistantList?.system || [];
  const sharedAssistants = assistantList?.shared || [];

  return (
    <div className="assistants-page">
      <div className="assistants-header">
        <h1 className="assistants-title">My Assistants</h1>
        <button onClick={handleOpenCreateModal} className="create-assistant-button">
          <MdAdd size={20} /> Create Assistant
        </button>
      </div>

      <AddExternalAssistant onAddExternal={handleAddExternal} />

      {pendingAssistantId && !isConnected && (
        <div className="loading-message">
          Connecting to add shared assistant...
        </div>
      )}

      <div className="assistants-section">
        <h2 className="assistants-section-title">My Assistants</h2>
        <div className="assistants-grid">
          {ownedAssistants.length > 0 ? (
            ownedAssistants.map(assistant => (
              <AssistantCard
                key={assistant.id}
                assistant={assistant}
                variant="owned"
                onToggleFavorite={handleToggleVisibility}
                onShare={handleShareAssistant}
                onEdit={handleStartEdit}
                onDelete={handleDeleteAssistant}
              />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">No assistants yet</div>
              <div className="empty-state-description">Create your first assistant to get started</div>
            </div>
          )}
        </div>
      </div>

      <div className="assistants-section">
        <h2 className="assistants-section-title">System Assistants</h2>
        <div className="assistants-grid">
          {systemAssistants.map(assistant => (
            <AssistantCard
              key={assistant.id}
              assistant={assistant}
              variant="system"
              onToggleFavorite={handleToggleVisibility}
            />
          ))}
        </div>
      </div>

      <div className="assistants-section">
        <h2 className="assistants-section-title">Shared Assistants</h2>
        <div className="assistants-grid">
          {sharedAssistants.length > 0 ? (
            sharedAssistants.map(assistant => (
              <AssistantCard
                key={assistant.id}
                assistant={assistant}
                variant="shared"
                onToggleFavorite={handleToggleVisibility}
              />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">No shared assistants</div>
              <div className="empty-state-description">Shared assistants from other users will appear here</div>
            </div>
          )}
        </div>
      </div>

      <AssistantModal
        isOpen={showCreateModal || editingAssistant !== null}
        editingAssistant={editingAssistant}
        formData={formData}
        models={models}
        onClose={closeModal}
        onSubmit={editingAssistant ? handleUpdateAssistant : handleCreateAssistant}
        onFormChange={setFormData}
      />

      <ShareModal
        isOpen={shareModalAssistant !== null}
        assistant={shareModalAssistant}
        onClose={() => setShareModalAssistant(null)}
        onCopyLink={copyShareLink}
        onCopyGuid={copyGuid}
      />
    </div>
  );
};

export default AssistantsPage;
