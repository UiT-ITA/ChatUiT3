import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ModelsTab.css';
import ModelCard from './ModelCard';
import ModelModal from './ModelModal';
import { getModels, getEndpoints, createModel, updateModel, deleteModel } from '../../services/adminService';
import type { ModelDto, CreateModelDto, UpdateModelDto, EndpointDto, UserRole } from '../../types/admin';

const ALL_ROLES: UserRole[] = ['User', 'Admin', 'Beta', 'Super', 'External'];

const ModelsTab: React.FC = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState<ModelDto[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ModelDto | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [mods, eps] = await Promise.all([getModels(), getEndpoints()]);
      setModels(mods ?? []);
      setEndpoints(eps ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const endpointLabel = (id: string) => endpoints.find(e => e.id === id)?.url ?? '';
  const endpointProviderOf = (id: string) => endpoints.find(e => e.id === id)?.endpointType ?? '';

  const handleCreateSave = async (payload: CreateModelDto) => {
    await createModel(payload);
    setShowCreate(false);
    await load();
  };

  const handleEditSave = async (payload: UpdateModelDto) => {
    await updateModel(payload.id, payload);
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.models.dialog.delete.confirm'))) return;
    await deleteModel(id);
    await load();
  };

  return (
    <div className="admin-section">
      <div className="admin-subheader">
        <h2 className="admin-section-title">{t('admin.models.title')}</h2>
        <button className="admin-create-button" onClick={() => setShowCreate(true)}>
          {t('admin.models.add.title')}
        </button>
      </div>

      {loading ? (
        <div className="admin-empty">{t('common.loading')}</div>
      ) : models.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-title">{t('admin.models.list.empty')}</div>
        </div>
      ) : (
        <div className="admin-grid">
          {models.map(m => (
            <ModelCard
              key={m.id}
              model={m}
              endpointLabel={endpointLabel(m.endpointId)}
              endpointProvider={endpointProviderOf(m.endpointId)}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ModelModal
        isOpen={showCreate}
        mode="create"
        endpoints={endpoints}
        allRoles={ALL_ROLES}
        onCancel={() => setShowCreate(false)}
        onSave={handleCreateSave}
      />

      {editing && (
        <ModelModal
          isOpen={true}
          mode="edit"
          initial={{
            id: editing.id,
            modelName: editing.modelName,
            endpointId: editing.endpointId,
            allowedRoles: editing.allowedRoles
          }}
          endpoints={endpoints}
          allRoles={ALL_ROLES}
          onCancel={() => setEditing(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};

export default ModelsTab;
