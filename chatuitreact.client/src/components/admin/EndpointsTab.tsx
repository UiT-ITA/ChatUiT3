import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './EndpointsTab.css';
import EndpointCard from './EndpointCard';
import EndpointModal from './EndpointModal';
import { getEndpoints, createEndpoint, updateEndpoint, deleteEndpoint } from '../../services/adminService';
import type { EndpointDto, CreateEndpointDto, UpdateEndpointDto } from '../../types/admin';

const EndpointsTab: React.FC = () => {
  const { t } = useTranslation();
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EndpointDto | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getEndpoints();
      setEndpoints(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateSave = async (payload: CreateEndpointDto) => {
    await createEndpoint(payload);
    setShowCreate(false);
    await load();
  };

  const handleEditSave = async (payload: UpdateEndpointDto) => {
    await updateEndpoint(payload.id, payload);
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.endpoints.dialog.delete.confirm'))) return;
    await deleteEndpoint(id);
    await load();
  };

  return (
    <div className="admin-section">
      <div className="admin-subheader">
        <h2 className="admin-section-title">{t('admin.endpoints.title')}</h2>
        <button className="admin-create-button" onClick={() => setShowCreate(true)}>
          {t('admin.endpoints.add.title')}
        </button>
      </div>

      {loading ? (
        <div className="admin-empty">{t('common.loading')}</div>
      ) : endpoints.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-title">{t('admin.endpoints.list.empty')}</div>
        </div>
      ) : (
        <div className="admin-grid">
          {endpoints.map(ep => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <EndpointModal
        isOpen={showCreate}
        mode="create"
        onCancel={() => setShowCreate(false)}
        onSave={handleCreateSave}
      />

      {editing && (
        <EndpointModal
          isOpen={true}
          mode="edit"
          initial={{ id: editing.id, url: editing.url, endpointType: editing.endpointType }}
          onCancel={() => setEditing(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};

export default EndpointsTab;
