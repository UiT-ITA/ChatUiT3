import { useTranslation } from 'react-i18next';
import { formatDuration } from '../../utils/durationUtils';
import "./ToolCallBlock.css";

type Props = {
  toolName: string;
  argumentsJson: string | null;
  result: string | null;
  isError: boolean;
  isComplete: boolean;
  /** Set once the call has finished. */
  durationMs: number | null;
};

function prettyMaybeJson(text: string | null): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

function truncateEnd(text: string, maxLen = 140): string {
  if (text.length <= maxLen) return text;
  const safeLen = Math.max(0, maxLen - 3);
  return text.slice(0, safeLen) + "...";
}

export default function ToolCallBlock({
  toolName,
  argumentsJson,
  result,
  isError,
  isComplete,
  durationMs,
}: Props) {
  const { t } = useTranslation();
  const prettyArgs = prettyMaybeJson(argumentsJson);
  const prettyResult = prettyMaybeJson(result);
  const argsInline = argumentsJson?.replace(/\s+/g, " ") ?? "";
  const argsPreview = argsInline.length > 0 ? truncateEnd(argsInline, 140) : "";

  const status = !isComplete
    ? t('chat.status.running')
    : isError
      ? t('chat.status.failed')
      : t('chat.status.done');

  return (
    <details className={`toolcall ${isComplete ? "complete" : "running"} ${isError ? "error" : ""}`}>
      <summary className="toolcall-summary t-ui-plain">
        <span className="toolcall-title-clip">
          <strong className="toolcall-name t-overline">{toolName}</strong>
          <span className="toolcall-args-inline t-meta">({argsPreview})</span>
        </span>
        <span className="toolcall-status t-overline">
          {status}
          {durationMs !== null && <span className="toolcall-duration t-meta"> · {formatDuration(durationMs)}</span>}
        </span>
      </summary>
      <div className="toolcall-body">
        {prettyArgs && (
          <div className="toolcall-section">
            <div className="toolcall-title t-overline">{t('toolCall.arguments')}</div>
            <pre className="toolcall-pre t-code">{prettyArgs}</pre>
          </div>
        )}
        {prettyResult && (
          <div className="toolcall-section">
            <div className="toolcall-title t-overline">{t('toolCall.result')}</div>
            <pre className="toolcall-pre t-code">{prettyResult}</pre>
          </div>
        )}
      </div>
    </details>
  );
}
