import React from 'react';
import { MdEdit, MdDelete } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import TagField from '../common/TagField';
import type { ModelDto } from '../../types/admin';
import './ModelCard.css';

interface ModelCardProps {
  model: ModelDto;
  endpointLabel: string;
  endpointProvider: string;
  onEdit: (model: ModelDto) => void;
  onDelete: (id: string) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({ model, endpointLabel, endpointProvider, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const localizedRoleTags = model.allowedRoles.map(r => t(`roles.${r}`));

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-info">
          <div className="admin-card-title-row">
            <h3 className="admin-card-title">{model.modelName}</h3>
            <TagField tags={localizedRoleTags} readonly={true} />
          </div>
          <p className="admin-card-description">{endpointLabel}</p>
        </div>

        <div className="admin-card-actions">
          <button
            onClick={() => onEdit(model)}
            className="admin-card-button"
            title="Edit"
            aria-label="Edit"
          >
            <MdEdit size={20} />
          </button>
          <button
            onClick={() => onDelete(model.id)}
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
          <div className="admin-card-model">{endpointProvider}</div>
        </div>
      </div>
    </div>
  );
};

export default ModelCard;
