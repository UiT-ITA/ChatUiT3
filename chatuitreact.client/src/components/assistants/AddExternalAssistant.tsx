import React, { useState } from 'react';
import { addSharedAssistant } from '../../services/assistantService';
import './AddExternalAssistant.css';

const AddExternalAssistant: React.FC = () => {
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
      <h3 className="add-external-assistant-title">Add Shared Assistant</h3>
      <p className="add-external-assistant-description">
        Enter the ID of a shared assistant to add it to your collection
      </p>
      <div className="add-external-assistant-form">
        <input
          type="text"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          placeholder="Enter assistant ID"
          className="add-external-assistant-input"
          disabled={loading}
        />
        <button
          onClick={handleAdd}
          disabled={!externalId.trim() || loading}
          className="add-external-assistant-button"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  );
};

export default AddExternalAssistant;
