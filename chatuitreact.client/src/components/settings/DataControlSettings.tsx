import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const DataControlSettings: React.FC = () => {
  const { t } = useTranslation();
  
  // Dummy state for data control settings
  const [retentionPeriod, setRetentionPeriod] = useState('1month');
  const [autoDelete, setAutoDelete] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');

  const retentionPeriods = [
    { id: '1week', label: t('settings.dataControl.retentionPeriod.1week') },
    { id: '1month', label: t('settings.dataControl.retentionPeriod.1month') },
    { id: '3months', label: t('settings.dataControl.retentionPeriod.3months') },
    { id: '1year', label: t('settings.dataControl.retentionPeriod.1year') },
    { id: 'forever', label: t('settings.dataControl.retentionPeriod.forever') },
  ];

  const exportFormats = [
    { id: 'json', label: t('settings.dataControl.exportFormat.json') },
    { id: 'markdown', label: t('settings.dataControl.exportFormat.markdown') },
    { id: 'txt', label: t('settings.dataControl.exportFormat.txt') },
  ];

  const handleDeleteAllChats = () => {
    // Dummy function - would show confirmation dialog
    console.log('Delete all chats clicked');
  };

  const handleExportData = () => {
    // Dummy function - would trigger export
    console.log('Export data clicked');
  };

  return (
    <div className="settings-section">
      <div className="settings-row">
        <label className="settings-label">{t('settings.dataControl.retentionPeriod.title')}</label>
        <div className="settings-control">
          <select 
            value={retentionPeriod} 
            onChange={(e) => setRetentionPeriod(e.target.value)}
            className="settings-select"
          >
            {retentionPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.dataControl.autoDelete.title')}</label>
        <div className="settings-control">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={autoDelete}
              onChange={(e) => setAutoDelete(e.target.checked)}
              className="settings-toggle-input"
            />
            <span className="settings-toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.dataControl.exportFormat.title')}</label>
        <div className="settings-control">
          <select 
            value={exportFormat} 
            onChange={(e) => setExportFormat(e.target.value)}
            className="settings-select"
          >
            {exportFormats.map((format) => (
              <option key={format.id} value={format.id}>
                {format.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.dataControl.exportData.title')}</label>
        <div className="settings-control">
          <button
            onClick={handleExportData}
            className="settings-button settings-button-secondary"
          >
            {t('settings.dataControl.exportData.button')}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.dataControl.deleteAll.title')}</label>
        <div className="settings-control">
          <button
            onClick={handleDeleteAllChats}
            className="settings-button settings-button-danger"
          >
            {t('settings.dataControl.deleteAll.button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataControlSettings;
