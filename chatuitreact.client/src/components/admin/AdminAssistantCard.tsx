import React from 'react';
import { MdEdit, MdDelete } from 'react-icons/md';
import { useSignals } from '@preact/signals-react/runtime';
import { getModels } from '../../services/modelService';
import type { AdminAssistantDto } from '../../types/admin';
import type { UserModelDto } from '../../types/modelModels';
import TagField from '../common/TagField';
import './ModelCard.css';

interface AdminAssistantCardProps {
  assistant: AdminAssistantDto;
  onEdit: (assistant: AdminAssistantDto) => void;
  onDelete: (id: string) => void;
}

const AdminAssistantCard: React.FC<AdminAssistantCardProps> = ({ assistant, onEdit, onDelete }) => {
  useSignals();
  const modelsSignal = getModels();
  const models: UserModelDto[] = modelsSignal.value ?? [];
  const modelName = models.find(model => model.id === assistant.modelId)?.modelName ?? assistant.modelId;

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-info">
          <div className="admin-card-title-row">
            <h3 className="admin-card-title">{assistant.name}</h3>
            <TagField tags={assistant.tags} readonly={true} />
          </div>
          <p className="admin-card-description">{assistant.description || assistant.systemPrompt || ''}</p>
        </div>

        <div className="admin-card-actions">
          <button
            onClick={() => onEdit(assistant)}
            className="admin-card-button"
            title="Edit"
            aria-label="Edit"
          >
            <MdEdit size={20} />
          </button>
          <button
            onClick={() => onDelete(assistant.id)}
            className="admin-card-button danger"
            title="Delete"
            aria-label="Delete"
          >
            <MdDelete size={20} />
          </button>
        </div>
      </div>

      <div className="admin-card-meta">
        <div className="admin-card-footer">
          <div className="admin-card-model">{modelName}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminAssistantCard;