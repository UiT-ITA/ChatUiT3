import { Button, makeStyles, mergeClasses, shorthands, Textarea } from "@fluentui/react-components";
import { useState } from "react";
import type { McpApprovalRequestItem } from "../api/types";
import { requestScopes } from "../auth/accountManager";
import { describeError, type ApprovalDecision, type ApprovalState } from "../conversation/conversation";
import { color, font, radius, typography } from "./tokens";

export interface ApprovalCardProps {
  request: McpApprovalRequestItem;
  state: ApprovalState;
  /** True while a response is streaming or tools are running. */
  disabled: boolean;
  onAnswer(decision: ApprovalDecision): Promise<void>;
}

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.625rem 0.75rem",
    border: `1px solid ${color.line}`,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  pending: { ...shorthands.borderColor(color.warn) },
  title: { ...typography.ui, color: color.text },
  text: { ...typography.uiPlain, color: color.text2 },
  caption: { ...typography.caption, color: color.text3 },
  fields: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    gap: "0.25rem 0.75rem",
    margin: 0,
  },
  field: { display: "contents" },
  label: { ...typography.overline, paddingTop: "0.125rem", color: color.text3 },
  value: { ...typography.uiPlain, margin: 0, overflowWrap: "anywhere", color: color.text },
  multiline: {
    ...typography.code,
    margin: 0,
    whiteSpace: "pre-wrap",
    maxHeight: "200px",
    overflow: "auto",
    padding: "0.375rem 0.5rem",
    backgroundColor: color.codeBg,
    border: `1px solid ${color.lineSoft}`,
    borderRadius: radius.sm,
    color: color.text,
  },
  actions: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  error: { ...typography.caption, color: color.danger },
  editor: { fontFamily: font.mono },
});

/**
 * An approval request from the server. Consent asks the user to grant Graph scopes through NAA;
 * confirmation shows the preview and lets the user approve, reject or edit the arguments.
 */
export function ApprovalCard({ request, state, disabled, onAnswer }: ApprovalCardProps) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(() => prettyJson(request.arguments));

  const answer = async (decision: ApprovalDecision) => {
    setBusy(true);
    setError(null);
    try {
      await onAnswer(decision);
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      setBusy(false);
    }
  };
  const locked = busy || disabled;

  const consent = request.chatuit_kind === "consent";
  const preview = request.chatuit_preview;
  const scopes = request.chatuit_required_scopes ?? [];
  const title = consent ? `${request.name} needs your permission` : preview?.title || `Run ${request.name}?`;

  if (state !== "pending") {
    return (
      <div className={styles.card}>
        <span className={styles.title}>{title}</span>
        <span className={styles.caption}>{outcome(state, consent)}</span>
      </div>
    );
  }

  const grant = async () => {
    setBusy(true);
    setError(null);
    try {
      if (scopes.length > 0) {
        await requestScopes(scopes);
      }
    } catch (reason) {
      setError(`Permission was not granted: ${describeError(reason)}`);
      setBusy(false);
      return;
    }
    await answer({ approve: true });
  };

  const editedIsValid = !editing || isJsonObject(edited);
  const changed = editing && edited.trim() !== prettyJson(request.arguments).trim();

  return (
    <div className={mergeClasses(styles.card, styles.pending)}>
      <span className={styles.title}>{title}</span>

      {consent ? (
        <>
          <span className={styles.text}>Grant access so ChatUiT can use {request.name} on your behalf.</span>
          {scopes.length > 0 && <span className={styles.caption}>Permissions: {scopes.join(", ")}</span>}
          <div className={styles.actions}>
            <Button appearance="primary" disabled={locked} onClick={() => void grant()}>
              Grant access
            </Button>
            <Button disabled={locked} onClick={() => void answer({ approve: false })}>
              Decline
            </Button>
          </div>
        </>
      ) : (
        <>
          {preview?.summary && <span className={styles.text}>{preview.summary}</span>}
          {preview && preview.fields.length > 0 && (
            <dl className={styles.fields}>
              {preview.fields.map((field, index) => (
                <div key={index} className={styles.field}>
                  <dt className={styles.label}>{field.label}</dt>
                  <dd className={field.multiline ? styles.multiline : styles.value}>{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {preview?.allow_edit && (
            <>
              <Button
                appearance="subtle"
                size="small"
                disabled={locked}
                onClick={() => setEditing((current) => !current)}
              >
                {editing ? "Hide arguments" : "Edit arguments"}
              </Button>
              {editing && (
                <Textarea
                  className={styles.editor}
                  value={edited}
                  onChange={(_event, data) => setEdited(data.value)}
                  rows={Math.min(16, Math.max(4, edited.split("\n").length))}
                  spellCheck={false}
                  disabled={locked}
                />
              )}
              {!editedIsValid && <span className={styles.error}>The arguments must be a JSON object.</span>}
            </>
          )}
          <div className={styles.actions}>
            <Button
              appearance="primary"
              disabled={locked || !editedIsValid}
              onClick={() => void answer({ approve: true, editedArguments: changed ? edited : undefined })}
            >
              Approve
            </Button>
            <Button disabled={locked} onClick={() => void answer({ approve: false })}>
              Reject
            </Button>
          </div>
        </>
      )}

      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

function outcome(state: Exclude<ApprovalState, "pending">, consent: boolean): string {
  switch (state) {
    case "approved":
      return consent ? "Access granted." : "Approved.";
    case "rejected":
      return consent ? "Declined." : "Rejected.";
    case "unanswered":
      return "Not answered. The action was not performed.";
  }
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function isJsonObject(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}
