import React from 'react';
import './FilePreview.css';

/** A scrolling column with the parts of a file, one under the other. */
export const FilePreview: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="file-preview-content">{children}</div>
);

/** An image part of a file preview. */
export const FilePreviewImage: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => (
  <img src={src} alt={alt} className="file-preview-image" />
);

/** A document shown by the browser's own viewer, such as a PDF. */
export const FilePreviewDocument: React.FC<{ src: string; title: string }> = ({ src, title }) => (
  <iframe src={src} title={title} className="file-preview-document" />
);

/** A plain text part of a file preview, in the code face with its line breaks kept. */
export const FilePreviewText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="file-preview-text t-code">{children}</pre>
);
