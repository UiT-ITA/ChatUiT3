import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createAdminAssistant, updateAdminAssistant, deleteAdminAssistant } from '../../services/adminService';
import { adminAssistantsSignal, loadAdminData } from '../../services/adminDataService';
import type { CreateAdminAssistantDto, UpdateAdminAssistantDto } from '../../types/admin';
import AssistantForm from '../assistants/AssistantForm';
import Button from '../common/Button';
import { ConfirmDialog } from '../common/Dialog';

interface AdminAssistantEditorProps {
  assistantId?: string;
}

const AdminAssistantEditor: React.FC<AdminAssistantEditorProps> = ({ assistantId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const assistants = adminAssistantsSignal.value;
  const assistant = assistantId ? assistants?.find(a => a.id === assistantId) : undefined;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shownId, setShownId] = useState(assistantId);
  if (assistantId !== shownId) {
    setShownId(assistantId);
    setConfirmDelete(false);
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  if (assistantId && assistants === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (assistantId && assistants !== undefined && !assistant) {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
  }

  const handleCreate = async (payload: CreateAdminAssistantDto) => {
    await createAdminAssistant(payload);
    await loadAdminData(true);
    navigate('/admin/assistants');
  };

  const handleUpdate = async (payload: UpdateAdminAssistantDto) => {
    await updateAdminAssistant(payload.id, payload);
    await loadAdminData(true);
    navigate('/admin/assistants');
  };

  const handleDelete = async () => {
    if (!assistant || deleting) return;
    setDeleting(true);
    try {
      await deleteAdminAssistant(assistant.id);
      await loadAdminData(true);
      navigate('/admin/assistants');
    } catch (error) {
      console.error('Failed to delete assistant:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="t-page-title">
        {assistant ? assistant.name : t('admin.assistants.add.title')}
      </h1>
      <div className="page-title-bar" />

      <AssistantForm
        key={assistant?.id ?? 'new'}
        editingAssistant={assistant ?? null}
        systemAssistant
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        saveLabel={t('assistants.saveAssistant')}
        backPath="/admin/assistants"
        backLabel={t('admin.tabs.assistants')}
        footerExtra={assistant && (
          <Button variant="danger" ml="auto" onClick={() => setConfirmDelete(true)}>
            {t('common.delete')}
          </Button>
        )}
      />

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('assistants.actions.deleteAssistant')}
        message={t('admin.assistants.dialog.delete.confirm')}
        confirmLabel={t('common.delete')}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default AdminAssistantEditor;
