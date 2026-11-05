import React from 'react';
import { useTranslation } from 'react-i18next';
import { cancelGeneration, visibleOutputs, type MediaGenerationState } from '../../services/mediaGenerationService';
import Button from '../common/Button';
import Card from '../common/Card';
import Stack from '../common/Stack';
import Placeholder from '../common/Placeholder';
import Grid from '../common/Grid';
import Text from '../common/Text';
import TextLink from '../common/TextLink';
import ImageFrame from '../common/ImageFrame';

/** The file extension for an output's media type, for the download name. */
const extensionFor = (mediaType: string) => mediaType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';

/** One generation: what was asked, how it is going, and what it produced so far. */
const GenerationCard: React.FC<{ generation: MediaGenerationState }> = ({ generation }) => {
  const { t } = useTranslation();
  const outputs = visibleOutputs(generation.outputs);
  const running = generation.status === 'Running';
  const pending = <Placeholder centered tone="muted" textVariant="caption" minHeight="2xs">{t('generate.generating')}</Placeholder>;

  return (
    <Card gap="md">
      <Stack direction="row" gap="sm" align="center" justify="between" wrap>
        <Text as="div" variant="caption">
          {generation.modelName} · {new Date(generation.createdAt).toLocaleTimeString()} · {t(`generate.status.${generation.status}`)}
          {generation.outputTokens !== null && <> · {t('generate.tokens', { input: generation.inputTokens ?? 0, output: generation.outputTokens })}</>}
        </Text>
        {running && (
          <Button size="small" variant="secondary" startIcon="stop" onClick={() => void cancelGeneration(generation.id)}>
            {t('generate.cancel')}
          </Button>
        )}
      </Stack>

      <Text as="p" variant="body" wrap="pre">{generation.prompt}</Text>

      {generation.status === 'Failed' && generation.error && (
        <Text as="p" variant="body" tone="danger">{generation.error}</Text>
      )}

      {running && outputs.length === 0 && pending}

      {outputs.length > 0 && (
        <Grid fill minColumnWidth="xs" gap="md">
          {outputs.map(output => {
            const url = generation.outputUrls[output.id];
            return (
              <Stack as="figure" key={output.id} gap="sm">
                {url ? <ImageFrame src={url} alt={generation.prompt} dimmed={output.partialIndex !== null} /> : pending}
                {url && output.partialIndex === null && (
                  <TextLink
                    variant="ui"
                    href={url}
                    download={`generation-${generation.id}-${output.index + 1}.${extensionFor(output.mediaType)}`}
                  >
                    {t('generate.download')}
                  </TextLink>
                )}
              </Stack>
            );
          })}
        </Grid>
      )}
    </Card>
  );
};

export default GenerationCard;
