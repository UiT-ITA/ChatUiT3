import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { getGenerations, getImageModels } from '../../services/mediaGenerationService';
import type { ModelType } from '../../types/modelModels';
import SegmentedControl from '../common/SegmentedControl';
import Button from '../common/Button';
import Stack from '../common/Stack';
import ImageGenerationForm from './ImageGenerationForm';
import GenerationCard from './GenerationCard';
import './GeneratePage.css';

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
      <div className="generate-page">
        <div className="generate-page-content">
          <Stack gap="lg">
            <div>
              <Button variant="ghost" startIcon="back" onClick={() => navigate('/generate')}>
                {t('generate.newGeneration')}
              </Button>
            </div>
            {generations === undefined
              ? <p className="t-caption">{t('common.loading')}</p>
              : selected
                ? <GenerationCard generation={selected} />
                : <p className="t-body">{t('generate.notFound')}</p>}
          </Stack>
        </div>
      </div>
    );
  }

  const ofType = generations?.filter(g => g.type === type) ?? [];

  return (
    <div className="generate-page">
      <div className="generate-page-content">
        <h1 className="t-page-title">{t('generate.title')}</h1>
        <div className="page-title-bar" />
        <p className="generate-intro t-body-lg">{t('generate.intro')}</p>

        <Stack gap="xl">
          <SegmentedControl<GenerationType>
            label={t('generate.type')}
            value={type}
            onChange={setType}
            options={[
              { value: 'Image', label: t('generate.types.Image') },
              { value: 'Voice', label: t('generate.types.Voice'), disabled: true },
            ]}
          />

          {imageModels === undefined && <p className="t-caption">{t('common.loading')}</p>}
          {imageModels !== undefined && imageModels.length === 0 && (
            <p className="t-body">{t('generate.noModels')}</p>
          )}
          {imageModels !== undefined && imageModels.length > 0 && (
            <ImageGenerationForm models={imageModels} />
          )}

          {ofType.length > 0 && (
            <Stack gap="md">
              <h2 className="t-overline">{t('generate.recent')}</h2>
              {ofType.map(generation => (
                <GenerationCard key={generation.id} generation={generation} />
              ))}
            </Stack>
          )}
        </Stack>
      </div>
    </div>
  );
};

export default GeneratePage;
