import React, { useState } from 'react';

interface AddExternalAssistantProps {
  onAddExternal: (id: string) => void;
}

const AddExternalAssistant: React.FC<AddExternalAssistantProps> = ({ onAddExternal }) => {
  const [externalId, setExternalId] = useState('');

  const handleAdd = () => {
    if (!externalId.trim()) return;
    onAddExternal(externalId.trim());
    setExternalId('');
  };

  return (
    <div className="add-external-assistant">
      <h3 className="add-external-assistant-title">Add External Assistant</h3>
      <p className="add-external-assistant-description">
        Paste an assistant ID to add a shared assistant to your collection
      </p>
      <div className="add-external-assistant-form">
        <input
          type="text"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          placeholder="Paste assistant ID here..."
          className="add-external-assistant-input"
        />
        <button
          onClick={handleAdd}
          disabled={!externalId.trim()}
          className="add-external-assistant-button"
        >
          Add
        </button>
      </div>
    </div>
  );
};

export default AddExternalAssistant;
