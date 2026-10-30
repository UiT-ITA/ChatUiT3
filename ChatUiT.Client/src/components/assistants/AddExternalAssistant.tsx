import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addSharedAssistant } from '../../services/assistantService';
import TextInput from '../common/TextInput';
import Button from '../common/Button';
import './AddExternalAssistant.css';

const AddExternalAssistant: React.FC = () => {
  const { t } = useTranslation();
  const [externalId, setExternalId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!externalId.trim() || loading) return;
    
    setLoading(true);
    try {
      await addSharedAssistant(externalId.trim());
      setExternalId('');
    } catch (error) {
      console.error('Failed to add shared assistant:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-external-assistant">
      <h3 className="add-external-assistant-title t-overline">{t('assistants.addExternal.title')}</h3>
      <p className="add-external-assistant-description t-caption">
        {t('assistants.addSharedAssistantDescription')}
      </p>
      <div className="add-external-assistant-form">
        <TextInput
          value={externalId}
          onChange={setExternalId}
          placeholder={t('assistants.addExternal.placeholder')}
          grow
          disabled={loading}
        />
        <Button
          variant="secondary"
          size="large"
          onClick={handleAdd}
          disabled={!externalId.trim() || loading}
        >
          {loading ? t('assistants.addExternal.adding') : t('assistants.addExternal.add')}
        </Button>
      </div>
    </div>
  );
};

export default AddExternalAssistant;
