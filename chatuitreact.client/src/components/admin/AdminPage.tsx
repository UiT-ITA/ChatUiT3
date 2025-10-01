import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './AdminPage.css';
import EndpointsTab from './EndpointsTab';
import ModelsTab from './ModelsTab';

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'endpoints' | 'models'>('endpoints');

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
          </div>
        </div>

        <div className="admin-section">
          {tab === 'endpoints' ? <EndpointsTab /> : <ModelsTab />}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
