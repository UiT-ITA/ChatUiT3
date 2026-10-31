import React from 'react';
import { useTranslation } from 'react-i18next';
import { cancelGeneration, visibleOutputs, type MediaGenerationState } from '../../services/mediaGenerationService';
import Button from '../common/Button';
import Card from '../common/Card';
import Stack from '../common/Stack';

/** The file extension for an output's media type, for the download name. */
const extensionFor = (mediaType: string) => mediaType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';

/** One generation: what was asked, how it is going, and what it produced so far. */
const GenerationCard: React.FC<{ generation: MediaGenerationState }> = ({ generation }) => {
  const { t } = useTranslation();
  const outputs = visibleOutputs(generation.outputs);
  const running = generation.status === 'Running';

  return (
    <Card>
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center" justify="between" wrap>
          <div className="t-caption">
            {generation.modelName} · {new Date(generation.createdAt).toLocaleTimeString()} · {t(`generate.status.${generation.status}`)}
            {generation.outputTokens !== null && <> · {t('generate.tokens', { input: generation.inputTokens ?? 0, output: generation.outputTokens })}</>}
          </div>
          {running && (
            <Button size="small" variant="secondary" startIcon="stop" onClick={() => void cancelGeneration(generation.id)}>
              {t('generate.cancel')}
            </Button>
          )}
        </Stack>

        <p className="t-body generate-prompt">{generation.prompt}</p>

        {generation.status === 'Failed' && generation.error && (
          <p className="t-body generate-error">{generation.error}</p>
        )}

        {running && outputs.length === 0 && <div className="generate-output-placeholder t-caption">{t('generate.generating')}</div>}

        {outputs.length > 0 && (
          <div className="generate-outputs">
            {outputs.map(output => {
              const url = generation.outputUrls[output.id];
              return (
                <figure key={output.id} className="generate-output">
                  {url ? (
                    <img src={url} alt={generation.prompt} className={output.partialIndex !== null ? 'generate-output-partial' : undefined} />
                  ) : (
                    <div className="generate-output-placeholder t-caption">{t('generate.generating')}</div>
                  )}
                  {url && output.partialIndex === null && (
                    <a
                      className="generate-download t-ui"
                      href={url}
                      download={`generation-${generation.id}-${output.index + 1}.${extensionFor(output.mediaType)}`}
                    >
                      {t('generate.download')}
                    </a>
                  )}
                </figure>
              );
            })}
          </div>
        )}
      </Stack>
    </Card>
  );
};

export default GenerationCard;
