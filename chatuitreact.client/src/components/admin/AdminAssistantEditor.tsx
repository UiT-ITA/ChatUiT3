import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createAdminAssistant, updateAdminAssistant, deleteAdminAssistant } from '../../services/adminService';
import { adminAssistantsSignal, loadAdminData } from '../../services/adminDataService';
import type { CreateAdminAssistantDto, UpdateAdminAssistantDto } from '../../types/admin';
import AssistantForm from '../assistants/AssistantForm';

interface AdminAssistantEditorProps {
  assistantId?: string;
}

const AdminAssistantEditor: React.FC<AdminAssistantEditorProps> = ({ assistantId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const assistants = adminAssistantsSignal.value;
  const assistant = assistantId ? assistants?.find(a => a.id === assistantId) : undefined;

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
    navigate('/admin');
  };

  const handleUpdate = async (payload: UpdateAdminAssistantDto) => {
    await updateAdminAssistant(payload.id, payload);
    await loadAdminData(true);
    navigate('/admin');
  };

  const handleDelete = async () => {
    if (!assistant) return;
    if (!window.confirm(t('admin.assistants.dialog.delete.confirm'))) return;
    await deleteAdminAssistant(assistant.id);
    await loadAdminData(true);
    navigate('/admin');
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
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        saveLabel={t('assistants.saveAssistant')}
        footerExtra={
          <>
            <button className="admin-cancel-button t-ui" onClick={() => navigate('/admin')}>
              {t('common.cancel')}
            </button>
            {assistant && (
              <>
                <div className="admin-footer-spacer" />
                <button className="admin-delete-button t-ui" onClick={handleDelete}>
                  {t('common.delete')}
                </button>
              </>
            )}
          </>
        }
      />
    </div>
  );
};

export default AdminAssistantEditor;
