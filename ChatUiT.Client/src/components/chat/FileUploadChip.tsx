import { useTranslation } from 'react-i18next';
import FileChip from '../common/FileChip';
import type { FileUpload } from '../../types/fileModels';

/** A chip for a file of a message that is being sent: its name and how far its upload has come. */
const FileUploadChip = ({ upload }: { upload: FileUpload }) => {
  const { t } = useTranslation();

  const status = upload.status === 'uploading'
    ? t('files.upload.uploading', { percent: Math.round(upload.progress * 100) })
    : t(`files.upload.${upload.status}`);

  return <FileChip name={upload.name} title={upload.name} extension={status} />;
};

export default FileUploadChip;
