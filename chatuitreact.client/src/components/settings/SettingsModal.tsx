import React, { useState } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import GeneralSettings from './GeneralSettings';
import PersonalizationSettings from './PersonalizationSettings';
import DataControlSettings from './DataControlSettings';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'personalization' | 'data';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const tabs = [
    { id: 'general' as const, label: t('settings.generalTab'), icon: '⚙️' },
    { id: 'personalization' as const, label: t('settings.personalizationTab'), icon: '👤' },
    { id: 'data' as const, label: t('settings.dataTab'), icon: '🗃️' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'personalization':
        return <PersonalizationSettings />;
      case 'data':
        return <DataControlSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div 
      className="settings-modal-backdrop" 
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">{t('settings.title')}</h2>
          <button 
            className="settings-modal-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <RiCloseLine size={20} />
          </button>
        </div>

        <div className="settings-modal-body">
          <div className="settings-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="settings-tab-icon">{tab.icon}</span>
                <span className="settings-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-content">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
