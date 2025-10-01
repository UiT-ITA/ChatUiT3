import React from 'react';
import { MdEdit, MdDelete } from 'react-icons/md';
import type { EndpointDto } from '../../types/admin';
import './EndpointCard.css';

interface EndpointCardProps {
  endpoint: EndpointDto;
  onEdit: (endpoint: EndpointDto) => void;
  onDelete: (id: string) => void;
}

const EndpointCard: React.FC<EndpointCardProps> = ({ endpoint, onEdit, onDelete }) => {
  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-info">
          <div className="admin-card-title-row">
            <h3 className="admin-card-title">{endpoint.url}</h3>
          </div>
        </div>

        <div className="admin-card-actions">
          <button
            onClick={() => onEdit(endpoint)}
            className="admin-card-button"
            title="Edit"
            aria-label="Edit"
          >
            <MdEdit size={20} />
          </button>
          <button
            onClick={() => onDelete(endpoint.id)}
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
          <div className="admin-card-model">{endpoint.endpointType}</div>
        </div>
      </div>
    </div>
  );
};

export default EndpointCard;
