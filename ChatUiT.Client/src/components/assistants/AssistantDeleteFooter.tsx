import React from 'react';
import { useTranslation } from 'react-i18next';
import FormFooter from '../common/FormFooter';
import Button from '../common/Button';

/** The form footer with the button that deletes an assistant. */
const AssistantDeleteFooter: React.FC<{ onDelete: () => void }> = ({ onDelete }) => {
  const { t } = useTranslation();
  return (
    <FormFooter>
      <Button variant="danger" ml="auto" onClick={onDelete}>
        {t('common.delete')}
      </Button>
    </FormFooter>
  );
};

export default AssistantDeleteFooter;
