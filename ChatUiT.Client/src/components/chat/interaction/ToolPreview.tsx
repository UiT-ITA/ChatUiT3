import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolPreviewDto, ToolPreviewFieldRole, ToolPreviewKind } from '../../../types/chatModels';
import DescriptionList from '../../common/DescriptionList';
import Stack from '../../common/Stack';
import Text from '../../common/Text';
import TextBlock from '../../common/TextBlock';

/** Per kind: the roles listed as label and value rows, then the roles shown as blocks, in order. */
const LAYOUTS: Record<ToolPreviewKind, { rows: ToolPreviewFieldRole[]; blocks: ToolPreviewFieldRole[] }> = {
  general: { rows: [], blocks: [] },
  message: { rows: ['recipients', 'subject', 'attachments'], blocks: ['body'] },
  file: { rows: ['path'], blocks: ['content'] },
  documentEdit: { rows: ['document'], blocks: ['changes'] },
  event: { rows: ['subject', 'time', 'location', 'attendees'], blocks: ['body'] },
};

/**
 * The fields of a preview laid out for its kind: the kind's row fields first, then its block
 * fields, then every other field as a row, or as a block when it is multiline.
 */
export default function ToolPreview({ preview }: { preview: ToolPreviewDto }) {
  const layout = LAYOUTS[preview.kind] ?? LAYOUTS.general;
  const byRole = (roles: ToolPreviewFieldRole[]) =>
    roles.flatMap(role => preview.fields.filter(field => field.role === role));

  const rows = byRole(layout.rows);
  const blocks = byRole(layout.blocks);
  const placed = new Set([...rows, ...blocks]);
  const rest = preview.fields.filter(field => !placed.has(field));
  const rowFields = [...rows, ...rest.filter(field => !field.multiline)];

  return (
    <Stack gap="md">
      {preview.summary && (
        <Text as="div" variant="ui" tone="secondary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.summary}</ReactMarkdown>
        </Text>
      )}
      {rowFields.length > 0 && (
        <DescriptionList
          density="compact"
          termVariant="overline"
          detailsVariant="table"
          items={rowFields.map(field => ({ term: field.label, details: field.role === 'subject' ? <Text variant="body-strong">{field.value}</Text> : field.value }))}
        />
      )}
      {[...blocks, ...rest.filter(field => field.multiline)].map((field, index) => (
        <Stack key={index} gap="xs">
          <Text as="div" variant="overline" tone="muted" mt="xs">{field.label}</Text>
          <TextBlock surface={field.role === 'body' ? 'panel' : 'code'} monospace={field.role === 'content'}>{field.value}</TextBlock>
        </Stack>
      ))}
    </Stack>
  );
}
