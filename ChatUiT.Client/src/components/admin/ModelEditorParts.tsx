import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteModel, testModel } from '../../services/adminService';
import { loadAdminData } from '../../services/adminDataService';
import type { CatalogModelDto, EndpointDto, ModelTestResultDto, UserRole } from '../../types/admin';
import { Icon } from '../common/Icon';
import Select from '../common/Select';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field from '../common/Field';
import Button from '../common/Button';
import { ConfirmDialog } from '../common/Dialog';
import ModelCombobox, { type ModelComboboxOption } from './ModelCombobox';
import { ALL_ROLES } from './modelEditorShared';

/** The fields and footer every model type's editor shares. */

export const EndpointSelect: React.FC<{ value: string; endpoints: EndpointDto[]; onChange: (value: string) => void }> = ({ value, endpoints, onChange }) => {
  const { t } = useTranslation();
  return (
    <Select label={t('admin.models.fields.endpoint')} value={value} onChange={onChange}>
      {value === '' && (
        <option value="" disabled>{t('admin.models.fields.endpointNone')}</option>
      )}
      {endpoints.map(ep => (
        <option key={ep.id} value={ep.id}>
          {ep.url} ({t(`admin.endpointType.${ep.endpointType}`)})
        </option>
      ))}
    </Select>
  );
};

export const ModelIdField: React.FC<{ value: string; options: ModelComboboxOption[]; onChange: (value: string) => void }> = ({ value, options, onChange }) => {
  const { t } = useTranslation();
  return (
    <Field label={t('admin.models.fields.modelId')}>
      <ModelCombobox
        value={value}
        options={options}
        placeholder={t('admin.models.fields.modelIdPlaceholder')}
        addedLabel={t('admin.models.fields.modelIdAdded')}
        otherLabel={t('admin.models.fields.modelIdOther')}
        onChange={onChange}
      />
    </Field>
  );
};

/** Picks a catalog entry to prefill from. '' is custom values. */
export function KnownModelSelect<T extends CatalogModelDto>({ catalog, value, onSelect, onClear }: {
  catalog: T[];
  value: string;
  onSelect: (entry: T) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Select
      label={t('admin.models.fields.knownModel')}
      description={t('admin.models.fields.knownModelHint')}
      value={value}
      onChange={(selected) => {
        const entry = catalog.find(c => c.modelId === selected);
        if (entry) onSelect(entry);
        else onClear();
      }}
    >
      <option value="">{t('admin.models.fields.knownModelCustom')}</option>
      {catalog.map(entry => (
        <option key={entry.modelId} value={entry.modelId}>
          {entry.displayName} ({t(`admin.endpointType.${entry.provider}`)})
        </option>
      ))}
    </Select>
  );
}

export const AllowedRolesField: React.FC<{ value: UserRole[]; onChange: (roles: UserRole[]) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const toggleRole = (role: UserRole, checked: boolean) => {
    const set = new Set(value);
    if (checked) set.add(role);
    else set.delete(role);
    onChange(Array.from(set));
  };

  return (
    <Field
      label={t('admin.models.fields.allowedRoles')}
      description={value.length === 0 ? t('admin.models.fields.allowedRolesRequired') : undefined}
    >
      <CheckboxGroup>
        {ALL_ROLES.map(role => (
          <Checkbox
            key={role}
            checked={value.includes(role)}
            onChange={(checked) => toggleRole(role, checked)}
          >
            {t(`roles.${role}`)}
          </Checkbox>
        ))}
      </CheckboxGroup>
    </Field>
  );
};

/** Test and delete for a saved model. Testing is off while the form has unsaved changes. */
export const ModelEditorFooter: React.FC<{ modelId: string; dirty: boolean }> = ({ modelId, dirty }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ModelTestResultDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [syncedModelId, setSyncedModelId] = useState(modelId);
  if (modelId !== syncedModelId) {
    setSyncedModelId(modelId);
    setTestResult(null);
    setConfirmDelete(false);
  }

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testModel(modelId));
    } catch (error) {
      setTestResult({ success: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteModel(modelId);
      await loadAdminData(true);
      navigate('/admin/models');
    } catch (error) {
      console.error('Failed to delete model:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="admin-form-footer">
        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={testing || dirty}
          title={dirty ? t('admin.models.test.saveFirst') : undefined}
        >
          {testing ? t('admin.models.test.running') : t('admin.models.test.button')}
        </Button>
        {testResult?.success && (
          <span className="admin-test-success" title={testResult.response ?? undefined}>
            <Icon name="check" size="xl" color="success" />
          </span>
        )}
        {testResult && !testResult.success && (
          <span className="admin-test-error t-caption">{testResult.error}</span>
        )}
        <Button variant="danger" ml="auto" onClick={() => setConfirmDelete(true)}>
          {t('admin.models.actions.delete')}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('admin.models.dialog.delete.title')}
        message={t('admin.models.dialog.delete.confirm')}
        confirmLabel={t('admin.models.actions.delete')}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};
