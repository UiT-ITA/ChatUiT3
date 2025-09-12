import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { SettingsCategory } from '../../types/settingsModels';
import { Icon } from '../common/Icon';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting, exportData, deleteAllData } = useSettings();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    // Apply theme data attributes to let CSS cascade naturally
    if (isOpen) {
      setTimeout(() => {
        const lightOption = document.querySelector('.theme-option[data-theme="light"]');
        const dimOption = document.querySelector('.theme-option[data-theme="dim"]');
        const darkOption = document.querySelector('.theme-option[data-theme="dark"]');

        // Apply theme attributes to let your existing CSS variables work
        if (lightOption) {
          lightOption.setAttribute('data-theme', 'light');
        }
        if (dimOption) {
          dimOption.setAttribute('data-theme', 'dim');
        }
        if (darkOption) {
          darkOption.setAttribute('data-theme', 'dark');
        }
      }, 0);
    }
  }, [isOpen, activeCategory]);

  if (!isOpen) return null;

  const categories = [
    { id: 'appearance' as SettingsCategory, label: 'Appearance', icon: 'settings' },
    { id: 'personalization' as SettingsCategory, label: 'Personalization', icon: 'user' },
    { id: 'dataControl' as SettingsCategory, label: 'Data Control', icon: 'admin' },
  ];

  const renderAppearanceSettings = () => (
    <div className="settings-section">
      <h3>Appearance</h3>
      
      <div className="setting-group">
        <label className="setting-label">Theme</label>
        <div className="theme-selector">
          <div
            className={`theme-option ${settings.theme === 'light' ? 'active' : ''}`}
            onClick={() => updateSetting('theme', 'light')}
            data-theme="light"
          >
            <div className="theme-preview">Sample</div>
            <span className="theme-label">Light</span>
          </div>
          
          <div
            className={`theme-option ${settings.theme === 'dim' ? 'active' : ''}`}
            onClick={() => updateSetting('theme', 'dim')}
            data-theme="dim"
          >
            <div className="theme-preview">Sample</div>
            <span className="theme-label">Dim</span>
          </div>
          
          <div
            className={`theme-option ${settings.theme === 'dark' ? 'active' : ''}`}
            onClick={() => updateSetting('theme', 'dark')}
            data-theme="dark"
          >
            <div className="theme-preview">Sample</div>
            <span className="theme-label">Dark</span>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">Size</label>
        <div className="size-selector">
          <div
            className={`size-option ${settings.size === 'small' ? 'active' : ''}`}
            onClick={() => updateSetting('size', 'small')}
          >
            <div className="size-preview" style={{ fontSize: '14px' }}>Sample Text</div>
            <span className="size-label">Small</span>
          </div>
          
          <div
            className={`size-option ${settings.size === 'medium' ? 'active' : ''}`}
            onClick={() => updateSetting('size', 'medium')}
          >
            <div className="size-preview" style={{ fontSize: '16px' }}>Sample Text</div>
            <span className="size-label">Medium</span>
          </div>
          
          <div
            className={`size-option ${settings.size === 'large' ? 'active' : ''}`}
            onClick={() => updateSetting('size', 'large')}
          >
            <div className="size-preview" style={{ fontSize: '18px' }}>Sample Text</div>
            <span className="size-label">Large</span>
          </div>
          
          <div
            className={`size-option ${settings.size === 'xl' ? 'active' : ''}`}
            onClick={() => updateSetting('size', 'xl')}
          >
            <div className="size-preview" style={{ fontSize: '20px' }}>Sample Text</div>
            <span className="size-label">Extra Large</span>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">Language</label>
        <div className="language-selector">
          <div
            className={`language-option ${settings.language === 'en-US' ? 'active' : ''}`}
            onClick={() => updateSetting('language', 'en-US')}
          >
            <img src="/gb.svg" alt="English" className="flag-icon" />
            <span className="language-label">English</span>
          </div>
          
          <div
            className={`language-option ${settings.language === 'no-NB' ? 'active' : ''}`}
            onClick={() => updateSetting('language', 'no-NB')}
          >
            <img src="/no.svg" alt="Norwegian" className="flag-icon" />
            <span className="language-label">Norwegian</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPersonalizationSettings = () => (
    <div className="settings-section">
      <h3>Personalization</h3>
      
      <div className="setting-group">
        <label className="setting-label">Name</label>
        <input
          type="text"
          value={settings.userName}
          onChange={(e) => updateSetting('userName', e.target.value)}
          placeholder="Enter your name"
          className="setting-input"
        />
      </div>

      <div className="setting-group">
        <label className="setting-label">Job Role</label>
        <input
          type="text"
          value={settings.jobRole}
          onChange={(e) => updateSetting('jobRole', e.target.value)}
          placeholder="e.g., Software Engineer, Teacher, Student"
          className="setting-input"
        />
      </div>

      <div className="setting-group">
        <label className="setting-label">Response Style</label>
        <select
          value={settings.responseStyle}
          onChange={(e) => updateSetting('responseStyle', e.target.value as any)}
          className="setting-select"
        >
          <option value="creative">Creative</option>
          <option value="balanced">Balanced</option>
          <option value="precise">Precise</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-label">Response Length</label>
        <select
          value={settings.responseLength}
          onChange={(e) => updateSetting('responseLength', e.target.value as any)}
          className="setting-select"
        >
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-label">Custom Instructions</label>
        <textarea
          value={settings.customInstructions}
          onChange={(e) => updateSetting('customInstructions', e.target.value)}
          placeholder="Provide additional context or preferences for how the assistant should respond..."
          className="setting-textarea"
          rows={4}
        />
      </div>
    </div>
  );

  const renderDataControlSettings = () => (
    <div className="settings-section">
      <h3>Data Control</h3>
      
      <div className="setting-group">
        <label className="setting-label">Chat Retention Period</label>
        <select
          value={settings.chatRetentionPeriod}
          onChange={(e) => updateSetting('chatRetentionPeriod', e.target.value as any)}
          className="setting-select"
        >
          <option value="1week">1 Week</option>
          <option value="1month">1 Month</option>
          <option value="3months">3 Months</option>
          <option value="1year">1 Year</option>
          <option value="forever">Forever</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <input
            type="checkbox"
            checked={settings.autoDeleteOldChats}
            onChange={(e) => updateSetting('autoDeleteOldChats', e.target.checked)}
            className="setting-checkbox"
          />
          Auto-delete old chats
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label">Export Format</label>
        <select
          value={settings.exportFormat}
          onChange={(e) => updateSetting('exportFormat', e.target.value as any)}
          className="setting-select"
        >
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
          <option value="txt">Plain Text</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-label">Export Data</label>
        <button
          onClick={() => exportData(settings.exportFormat)}
          className="setting-button setting-button-primary"
        >
          Export All Data
        </button>
      </div>

      <div className="setting-group">
        <label className="setting-label">Delete All Data</label>
        <button
          onClick={deleteAllData}
          className="setting-button setting-button-danger"
        >
          Delete All Data
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeCategory) {
      case 'appearance':
        return renderAppearanceSettings();
      case 'personalization':
        return renderPersonalizationSettings();
      case 'dataControl':
        return renderDataControlSettings();
      default:
        return renderAppearanceSettings();
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button className="settings-close-button" onClick={onClose}>
            <Icon name="close" size={1.5} />
          </button>
        </div>

        <div className="settings-modal-content">
          <div className="settings-sidebar">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`settings-category-button ${
                  activeCategory === category.id ? 'active' : ''
                }`}
                onClick={() => setActiveCategory(category.id)}
              >
                <Icon name={category.icon as any} size={1.2} />
                <span>{category.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-content">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
