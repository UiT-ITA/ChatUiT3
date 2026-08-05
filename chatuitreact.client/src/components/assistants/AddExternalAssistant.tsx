import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addSharedAssistant } from '../../services/assistantService';
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
        <input
          type="text"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          placeholder={t('assistants.addExternal.placeholder')}
          className="add-external-assistant-input t-ui-plain"
          disabled={loading}
        />
        <button
          onClick={handleAdd}
          disabled={!externalId.trim() || loading}
          className="add-external-assistant-button t-ui"
        >
          {loading ? t('assistants.addExternal.adding') : t('assistants.addExternal.add')}
        </button>
      </div>
    </div>
  );
};

export default AddExternalAssistant;
