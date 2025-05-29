import React, { useState } from 'react';
import ProvidersAndModels from '../components/admin/ProvidersAndModels';
import AssistantsManager from '../components/admin/AssistantsManager';
import UsersManager from '../components/admin/UsersManager';
import NotificationsManager from '../components/admin/NotificationsManager';
import MetricsManager from '../components/admin/MetricsManager';
import './AdminPage.css';

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('providers');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="admin-page">
      <div className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'providers' ? 'active' : ''}`}
          onClick={() => handleTabChange('providers')}
        >
          Providers and Models
        </button>
        <button 
          className={`admin-tab ${activeTab === 'assistants' ? 'active' : ''}`}
          onClick={() => handleTabChange('assistants')}
        >
          Assistants
        </button>
        <button 
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => handleTabChange('users')}
        >
          Users
        </button>
        <button 
          className={`admin-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => handleTabChange('notifications')}
        >
          Notifications
        </button>
        <button 
          className={`admin-tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => handleTabChange('metrics')}
        >
          Metrics
        </button>
      </div>
      
      <div className="admin-content">
        {activeTab === 'providers' && <ProvidersAndModels />}
        {activeTab === 'assistants' && <AssistantsManager />}
        {activeTab === 'users' && <UsersManager />}
        {activeTab === 'notifications' && <NotificationsManager />}
        {activeTab === 'metrics' && <MetricsManager />}
      </div>
    </div>
  );
};

export default AdminPage;
