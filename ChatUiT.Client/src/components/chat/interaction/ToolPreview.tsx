import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolPreviewDto, ToolPreviewFieldDto, ToolPreviewFieldRole, ToolPreviewKind } from '../../../types/chatModels';

/** Per kind: the roles listed as label and value rows, then the roles shown as blocks, in order. */
const LAYOUTS: Record<ToolPreviewKind, { rows: ToolPreviewFieldRole[]; blocks: ToolPreviewFieldRole[] }> = {
  general: { rows: [], blocks: [] },
  message: { rows: ['recipients', 'subject', 'attachments'], blocks: ['body'] },
  file: { rows: ['path'], blocks: ['content'] },
  documentEdit: { rows: ['document'], blocks: ['changes'] },
  event: { rows: ['subject', 'time', 'location', 'attendees'], blocks: ['body'] },
};

const BLOCK_CLASS: Partial<Record<ToolPreviewFieldRole, string>> = {
  body: 'tool-preview-block--message',
  content: 'tool-preview-block--code',
  changes: 'tool-preview-block--list',
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

  return (
    <div className="tool-preview">
      {preview.summary && (
        <div className="tool-preview-summary t-ui">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.summary}</ReactMarkdown>
        </div>
      )}
      <Rows fields={[...rows, ...rest.filter(field => !field.multiline)]} />
      {[...blocks, ...rest.filter(field => field.multiline)].map((field, index) => (
        <div key={index} className="tool-preview-block-wrap">
          <div className="tool-preview-label t-overline">{field.label}</div>
          <div className={`tool-preview-block ${BLOCK_CLASS[field.role] ?? ''} t-table`}>{field.value}</div>
        </div>
      ))}
    </div>
  );
}

function Rows({ fields }: { fields: ToolPreviewFieldDto[] }) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <dl className="tool-preview-rows">
      {fields.map((field, index) => (
        <div key={index} className="tool-preview-row">
          <dt className="tool-preview-label t-overline">{field.label}</dt>
          <dd className={`t-table ${field.role === 'subject' ? 'tool-preview-value--strong' : ''}`}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
