import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAdminAssistants,
  createAdminAssistant,
  updateAdminAssistant,
  deleteAdminAssistant
} from '../../services/adminService';
import type { AdminAssistantDto, CreateAdminAssistantDto, UpdateAdminAssistantDto } from '../../types/admin';
import AssistantModal from '../assistants/AssistantModal';
import AdminAssistantCard from './AdminAssistantCard';
import './ModelsTab.css';

const AssistantsTab: React.FC = () => {
  const { t } = useTranslation();
  const [assistants, setAssistants] = useState<AdminAssistantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminAssistantDto | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const items = await getAdminAssistants();
      setAssistants(items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateSave = async (payload: CreateAdminAssistantDto) => {
    await createAdminAssistant(payload);
    setShowCreate(false);
    await load();
  };

  const handleEditSave = async (payload: UpdateAdminAssistantDto) => {
    await updateAdminAssistant(payload.id, payload);
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.assistants.dialog.delete.confirm'))) return;
    await deleteAdminAssistant(id);
    await load();
  };

  return (
    <div className="admin-section">
      <div className="admin-subheader">
        <h2 className="admin-section-title">{t('admin.assistants.title')}</h2>
        <button className="admin-create-button" onClick={() => setShowCreate(true)}>
          {t('admin.assistants.add.title')}
        </button>
      </div>

      {loading ? (
        <div className="admin-empty">{t('common.loading')}</div>
      ) : assistants.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-title">{t('admin.assistants.list.empty')}</div>
        </div>
      ) : (
        <div className="admin-grid">
          {assistants.map(assistant => (
            <AdminAssistantCard
              key={assistant.id}
              assistant={assistant}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AssistantModal
        isOpen={showCreate}
        editingAssistant={null}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreateSave}
        createTitle={t('admin.assistants.add.title')}
        editTitle={t('admin.assistants.dialog.edit.title')}
      />

      <AssistantModal
        isOpen={editing !== null}
        editingAssistant={editing}
        onClose={() => setEditing(null)}
        onUpdate={handleEditSave}
        createTitle={t('admin.assistants.add.title')}
        editTitle={t('admin.assistants.dialog.edit.title')}
      />
    </div>
  );
};

export default AssistantsTab;