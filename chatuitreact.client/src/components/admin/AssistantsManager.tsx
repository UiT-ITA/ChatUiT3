import React, { useState } from 'react';
import { MdAdd, MdEdit, MdDelete, MdPsychology } from 'react-icons/md';

const AssistantsManager: React.FC = () => {
  const [assistants] = useState([
    { 
      id: '1', 
      name: 'General Assistant', 
      model: 'GPT-4', 
      systemPrompt: 'You are a helpful AI assistant...', 
      temperature: 0.7,
      status: 'active'
    },
    { 
      id: '2', 
      name: 'Code Helper', 
      model: 'GPT-4', 
      systemPrompt: 'You are an expert programming assistant...', 
      temperature: 0.3,
      status: 'active'
    },
    { 
      id: '3', 
      name: 'Creative Writer', 
      model: 'GPT-3.5 Turbo', 
      systemPrompt: 'You are a creative writing assistant...', 
      temperature: 0.9,
      status: 'inactive'
    }
  ]);

  const handleAddAssistant = () => {
    console.log('Add assistant clicked');
  };

  const handleEditAssistant = (id: string) => {
    console.log('Edit assistant:', id);
  };

  const handleDeleteAssistant = (id: string) => {
    console.log('Delete assistant:', id);
  };

  return (
    <div>
      <div className="admin-section">
        <div className="admin-section-title">
          <MdPsychology size={20} />
          AI Assistants
          <button className="admin-button" onClick={handleAddAssistant}>
            <MdAdd size={16} /> Create Assistant
          </button>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Model</th>
              <th>System Prompt</th>
              <th>Temperature</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assistants.map((assistant) => (
              <tr key={assistant.id}>
                <td>{assistant.name}</td>
                <td>{assistant.model}</td>
                <td>
                  <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {assistant.systemPrompt}
                  </div>
                </td>
                <td>{assistant.temperature}</td>
                <td>
                  <span className={`status-badge ${assistant.status}`}>
                    {assistant.status}
                  </span>
                </td>
                <td>
                  <div className="button-group">
                    <button 
                      className="admin-button secondary" 
                      onClick={() => handleEditAssistant(assistant.id)}
                    >
                      <MdEdit size={14} />
                    </button>
                    <button 
                      className="admin-button danger" 
                      onClick={() => handleDeleteAssistant(assistant.id)}
                    >
                      <MdDelete size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          Assistant Configuration
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Assistant Name</label>
            <input type="text" className="admin-input" placeholder="Enter assistant name" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Model</label>
            <select className="admin-select">
              <option>GPT-4</option>
              <option>GPT-3.5 Turbo</option>
              <option>Claude 3 Sonnet</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Temperature</label>
            <input type="number" className="admin-input" min="0" max="1" step="0.1" defaultValue="0.7" />
          </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">System Prompt</label>
          <textarea 
            className="admin-textarea" 
            placeholder="Enter the system prompt for this assistant..."
            style={{ minHeight: '120px' }}
          />
        </div>
        <button className="admin-button">Save Assistant</button>
      </div>
    </div>
  );
};

export default AssistantsManager;
