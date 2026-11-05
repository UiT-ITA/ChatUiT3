import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { getGenerations, getImageModels } from '../../services/mediaGenerationService';
import type { ModelType } from '../../types/modelModels';
import SegmentedControl from '../common/SegmentedControl';
import { Icon } from '../common/Icon';
import Button from '../common/Button';
import Stack from '../common/Stack';
import Text from '../common/Text';
import ImageGenerationForm from './ImageGenerationForm';
import GenerationCard from './GenerationCard';
import PageTitleBar from '../common/PageTitleBar';
import Page, { PageIntro } from '../common/Page';

/** The generation types the page offers. Voice has no model API yet. */
type GenerationType = Exclude<ModelType, 'Language'>;

/**
 * Generates images, and later voice. /generate shows the form and the user's generations;
 * /generate/:generationId shows one generation.
 */
const GeneratePage: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { generationId } = useParams<{ generationId?: string }>();
  const [type, setType] = useState<GenerationType>('Image');
  const imageModels = getImageModels().value;
  const generations = getGenerations().value;

  const selected = generationId ? generations?.find(g => g.id === generationId) : undefined;

  if (generationId) {
    return (
      <Page flow="block">
        <Stack gap="lg">
          <Button variant="ghost" startIcon="back" alignSelf="start" onClick={() => navigate('/generate')}>
            {t('generate.newGeneration')}
          </Button>
          {generations === undefined
            ? <Text as="p" variant="caption">{t('common.loading')}</Text>
            : selected
              ? <GenerationCard generation={selected} />
              : <Text as="p" variant="body">{t('generate.notFound')}</Text>}
        </Stack>
      </Page>
    );
  }

  const ofType = generations?.filter(g => g.type === type) ?? [];

  return (
    <Page flow="block">
      <Text as="h1" variant="page-title">{t(`generate.heading.${type}`)}</Text>
      <PageTitleBar />
      <PageIntro>{t('generate.intro')}</PageIntro>

      <Stack gap="xl">
        <SegmentedControl<GenerationType>
          stretch
          maxWidth="sm"
          label={t('generate.type')}
          value={type}
          onChange={setType}
          options={[
            { value: 'Image', label: t('generate.types.Image'), leading: <Icon name="image" size="sm" /> },
            { value: 'Voice', label: t('generate.types.Voice'), leading: <Icon name="speaker" size="sm" />, disabled: true },
          ]}
        />

        {imageModels === undefined
          ? <Text as="p" variant="caption">{t('common.loading')}</Text>
          : imageModels.length === 0
            ? <Text as="p" variant="body">{t('generate.noModels')}</Text>
            : <ImageGenerationForm models={imageModels} />}

        {ofType.length > 0 && (
          <Stack gap="md">
            <Text as="h2" variant="overline">{t('generate.recent')}</Text>
            {ofType.map(generation => (
              <GenerationCard key={generation.id} generation={generation} />
            ))}
          </Stack>
        )}
      </Stack>
    </Page>
  );
};

export default GeneratePage;
