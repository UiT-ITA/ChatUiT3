import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AddExternalAssistantProps {
  onAddExternal: (id: string) => void;
}

const AddExternalAssistant: React.FC<AddExternalAssistantProps> = ({ onAddExternal }) => {
  const [externalId, setExternalId] = useState('');
  const { t } = useTranslation();

  const handleAdd = () => {
    if (!externalId.trim()) return;
    onAddExternal(externalId.trim());
    setExternalId('');
  };

  return (
    <div className="add-external-assistant">
      <h3 className="add-external-assistant-title">{t('assistants.addSharedAssistant')}</h3>
      <p className="add-external-assistant-description">
        {t('assistants.addSharedAssistantDescription')}
      </p>
      <div className="add-external-assistant-form">
        <input
          type="text"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          placeholder={t('assistants.addSharedAssistantPlaceholder')}
          className="add-external-assistant-input"
        />
        <button
          onClick={handleAdd}
          disabled={!externalId.trim()}
          className="add-external-assistant-button"
        >
          {t('common.add')}
        </button>
      </div>
    </div>
  );
};

export default AddExternalAssistant;
