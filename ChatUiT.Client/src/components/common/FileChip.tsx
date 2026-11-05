import React from 'react';
import { Icon } from './Icon';
import { cx } from './layout';
import './FileChip.css';

interface FileChipProps {
  // Shows the file as a square image thumbnail instead of its name
  image?: { src: string; alt: string };
  // The file name, and the full name as a tooltip
  name: React.ReactNode;
  title?: string;
  // The file type, such as PDF
  extension: React.ReactNode;
  // Makes the chip a button that calls this
  onClick?: () => void;
  // A remove button in the corner
  removeAction?: React.ReactNode;
}

/** An attached file: a framed name and type for a document, a square thumbnail for an image. */
const FileChip: React.FC<FileChipProps> = ({ image, name, title, extension, onClick, removeAction }) => {
  const body = image ? (
    <img src={image.src} alt={image.alt} className="file-chip__image" />
  ) : (
    <span className="file-chip__content">
      <Icon name="file" color="accent" />
      <span className="file-chip__info">
        <span className="file-chip__name t-caption-strong" title={title}>{name}</span>
        <span className="file-chip__extension t-meta">{extension}</span>
      </span>
    </span>
  );

  return (
    <div className={cx('file-chip', image ? 'file-chip--image' : 'file-chip--document')}>
      {onClick
        ? <button type="button" className="file-chip__body file-chip__body--clickable" onClick={onClick}>{body}</button>
        : <span className="file-chip__body">{body}</span>}
      {removeAction && <span className="file-chip__remove">{removeAction}</span>}
    </div>
  );
};

export default FileChip;
