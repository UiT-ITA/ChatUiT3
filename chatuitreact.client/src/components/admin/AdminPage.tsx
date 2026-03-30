import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './AdminPage.css';
import EndpointsTab from './EndpointsTab';
import ModelsTab from './ModelsTab';
import AssistantsTab from './AssistantsTab';

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'endpoints' | 'models' | 'assistants'>('endpoints');

  useEffect(() => {
    // No sidebar changes for now; page styling mirrors AssistantsPage
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-content">
        <div className="admin-header">
          <h1 className="admin-title">Admin</h1>
          <div className="admin-tabs">
            <button
              className={`admin-tab-button ${tab === 'endpoints' ? 'active' : ''}`}
              onClick={() => setTab('endpoints')}
            >
              {t('admin.tabs.endpoints')}
            </button>
            <button
              className={`admin-tab-button ${tab === 'models' ? 'active' : ''}`}
              onClick={() => setTab('models')}
            >
              {t('admin.tabs.models')}
            </button>
            <button
              className={`admin-tab-button ${tab === 'assistants' ? 'active' : ''}`}
              onClick={() => setTab('assistants')}
            >
              {t('admin.tabs.assistants')}
            </button>
          </div>
        </div>

        <div className="admin-section">
          {tab === 'endpoints' ? <EndpointsTab /> : tab === 'models' ? <ModelsTab /> : <AssistantsTab />}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
