import "./ToolCallBlock.css";

type Props = {
  functionLine: string;
  functionName?: string;
  argsText?: string;
  resultText?: string;
  isComplete: boolean;
};

function prettyMaybeJson(text?: string): string | undefined {
  if (!text) return text;
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
  functionLine,
  functionName,
  argsText,
  resultText,
  isComplete,
}: Props) {
  const prettyArgs = prettyMaybeJson(argsText);
  const prettyResult = prettyMaybeJson(resultText);
  const argsInline = argsText?.replace(/\s+/g, " ");
  const argsPreview = argsInline && argsInline.length > 0 ? truncateEnd(argsInline, 140) : undefined;

  return (
    <details className={`toolcall ${isComplete ? "complete" : "running"}`}>
      <summary className="toolcall-summary">
        <span className="toolcall-title-clip">
          <strong className="toolcall-name">{functionName ?? "ToolCall"}</strong>
          {functionName ? (
            <span className="toolcall-args-inline">({argsPreview})</span>
          ) : (
            <span>: {functionLine}</span>
          )}
        </span>
        <span className="toolcall-status">{isComplete ? "Done" : "Running…"}</span>
      </summary>
      <div className="toolcall-body">
        {argsText && (
          <div className="toolcall-section">
            <div className="toolcall-title">Arguments</div>
            <pre className="toolcall-pre">{prettyArgs}</pre>
          </div>
        )}
        {resultText && (
          <div className="toolcall-section">
            <div className="toolcall-title">Result</div>
            <pre className="toolcall-pre">{prettyResult}</pre>
          </div>
        )}
      </div>
    </details>
  );
}
