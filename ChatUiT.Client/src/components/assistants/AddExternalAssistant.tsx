import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addSharedAssistant } from '../../services/assistantService';
import TextInput from '../common/TextInput';
import Button from '../common/Button';
import Placeholder from '../common/Placeholder';
import InputRow from '../common/InputRow';
import Text from '../common/Text';

const AddExternalAssistant: React.FC = () => {
  const { t } = useTranslation();
  const [externalId, setExternalId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!externalId.trim() || loading) return;
    
    setLoading(true);
    try {
      await addSharedAssistant(externalId.trim());
      setExternalId('');
    } catch (error) {
      console.error('Failed to add shared assistant:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Placeholder interactive py="lg" px="lg" mb="xl">
      <Text as="h3" variant="overline" tone="muted" mb="sm">{t('assistants.addExternal.title')}</Text>
      <Text as="p" variant="caption" tone="muted" mb="md">
        {t('assistants.addSharedAssistantDescription')}
      </Text>
      <InputRow maxWidth="sm">
        <TextInput
          value={externalId}
          onChange={setExternalId}
          placeholder={t('assistants.addExternal.placeholder')}
          grow
          disabled={loading}
        />
        <Button
          variant="secondary"
          size="large"
          onClick={handleAdd}
          disabled={!externalId.trim() || loading}
        >
          {loading ? t('assistants.addExternal.adding') : t('assistants.addExternal.add')}
        </Button>
      </InputRow>
    </Placeholder>
  );
};

export default AddExternalAssistant;
