import React, { useState } from 'react';
import EndpointsManager from '../components/admin/EndpointsManager';
import ModelsManager from '../components/admin/ModelsManager';
import AssistantsManager from '../components/admin/AssistantsManager';
import './Admin.css';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('endpoints');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="admin-container">
      <h2>Admin Configuration</h2>
      
      <div className="admin-card">
        <div className="admin-tabs">
          <button 
            className={`tab-button ${activeTab === 'endpoints' ? 'active' : ''}`}
            onClick={() => handleTabChange('endpoints')}
          >
            Endpoints
          </button>
          <button 
            className={`tab-button ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => handleTabChange('models')}
          >
            Models
          </button>
          <button 
            className={`tab-button ${activeTab === 'assistants' ? 'active' : ''}`}
            onClick={() => handleTabChange('assistants')}
          >
            Assistants
          </button>
        </div>
        
        <div className="tab-content">
          {activeTab === 'endpoints' && <EndpointsManager />}
          {activeTab === 'models' && <ModelsManager />}
          {activeTab === 'assistants' && <AssistantsManager />}
        </div>
      </div>
    </div>
  );
};

export default Admin;
