import React from 'react';
import { cx } from './layout';
import './FilePreview.css';

interface FilePreviewProps {
  // Tighter padding and gaps
  compact?: boolean;
  children: React.ReactNode;
}

/** A scrolling column with the parts of a file, one under the other. */
export const FilePreview: React.FC<FilePreviewProps> = ({ compact = false, children }) => (
  <div className={cx('file-preview-content', compact && 'file-preview-content--compact')}>{children}</div>
);

/** An image part of a file preview. */
export const FilePreviewImage: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => (
  <img src={src} alt={alt} className="file-preview-image" />
);

/** A plain text part of a file preview, in the code face with its line breaks kept. */
export const FilePreviewText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="file-preview-text t-code">{children}</pre>
);
