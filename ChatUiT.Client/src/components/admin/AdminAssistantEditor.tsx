import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createAdminAssistant, updateAdminAssistant, deleteAdminAssistant } from '../../services/adminService';
import { adminAssistantsSignal, loadAdminData } from '../../services/adminDataService';
import type { CreateAdminAssistantDto, UpdateAdminAssistantDto } from '../../types/admin';
import AssistantForm from '../assistants/AssistantForm';
import AssistantDeleteFooter from '../assistants/AssistantDeleteFooter';
import { ConfirmDialog } from '../common/Dialog';
import PageTitleBar from '../common/PageTitleBar';
import EmptyNote from '../common/EmptyNote';
import Text from '../common/Text';

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
    return <EmptyNote>{t('common.loading')}</EmptyNote>;
  }

  if (assistantId && assistants !== undefined && !assistant) {
    return <EmptyNote>{t('common.notFound')}</EmptyNote>;
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
    <>
      <Text as="h1" variant="page-title">
        {assistant ? assistant.name : t('admin.assistants.add.title')}
      </Text>
      <PageTitleBar />

      <AssistantForm
        key={assistant?.id ?? 'new'}
        editingAssistant={assistant ?? null}
        systemAssistant
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        saveLabel={t('assistants.saveAssistant')}
        backPath="/admin/assistants"
        backLabel={t('admin.tabs.assistants')}
      />

      {assistant && <AssistantDeleteFooter onDelete={() => setConfirmDelete(true)} />}

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('assistants.actions.deleteAssistant')}
        message={t('admin.assistants.dialog.delete.confirm')}
        confirmLabel={t('common.delete')}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};

export default AdminAssistantEditor;
