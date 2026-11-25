/** How a stored file's original is shown: in the preview, downloaded, or not at all. */
export type FilePreviewKind = 'pdf' | 'image' | 'text' | 'markdown' | 'download' | 'none';

/** A file picked in the composer. It is uploaded when the message is sent. */
export interface ComposerFile {
  id: string;
  file: File;
}

export type FileUploadStatus = 'waiting' | 'uploading' | 'converting' | 'done';

/** The upload of one file of a message that is being sent. */
export interface FileUpload {
  id: string;
  name: string;
  status: FileUploadStatus;
  /** How much of the file is sent, from 0 to 1. */
  progress: number;
}
