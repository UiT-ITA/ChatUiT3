import React from 'react';
import './SettingRow.css';

/** A setting row: its name, then its control (the children), with a line under it. */
const SettingRow: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="setting-row">
    <div className="setting-row__label t-table-strong">{label}</div>
    {children}
  </div>
);

export default SettingRow;
