import React from 'react';
import { Icon, type IconName } from './Icon';
import './FileDrop.css';

interface FileDropProps {
  label: React.ReactNode;
  icon?: IconName;
  accept?: string;
  multiple?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/** A file picker and drop target drawn as a dashed area with an icon and a label. */
const FileDrop: React.FC<FileDropProps> = ({ label, icon = 'upload', accept, multiple = false, onChange }) => (
  <label className="file-drop">
    <Icon name={icon} size="md" color="accent" />
    <span className="t-ui">{label}</span>
    <input type="file" className="file-drop__input" accept={accept} multiple={multiple} onChange={onChange} />
  </label>
);

export default FileDrop;
