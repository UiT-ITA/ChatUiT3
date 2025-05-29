import React, { useState } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import AppearanceSettings from './AppearanceSettings';
import LanguageSettings from './LanguageSettings';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'language';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

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
    { id: 'appearance' as const, label: t('settings.appearanceTab'), icon: '🎨' },
    { id: 'language' as const, label: t('settings.languageTab'), icon: '🌐' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceSettings />;
      case 'language':
        return <LanguageSettings />;
      default:
        return <AppearanceSettings />;
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
            <RiCloseLine size={24} />
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
