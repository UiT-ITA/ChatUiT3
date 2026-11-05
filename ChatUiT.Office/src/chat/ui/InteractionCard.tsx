import { Button, makeStyles, mergeClasses, shorthands, Textarea } from "@fluentui/react-components";
import { useState, type ReactNode } from "react";
import type { ApprovalPreview, ApprovalPreviewField, PreviewFieldRole, PreviewKind } from "../api/types";
import { Icon, type IconName } from "./icons";
import { color, font, space, fw, lh, radius, border, opacity, control, icon, size, typography } from "./tokens";
import type { InteractionDock } from "./useInteractionDock";

const KIND_ICONS: Record<PreviewKind, IconName> = {
  general: "tools",
  message: "mail",
  file: "file",
  document_edit: "edit",
  event: "calendar",
};

/** Per kind: the roles listed as label and value rows, then the roles shown as blocks, in order. */
const LAYOUTS: Record<PreviewKind, { rows: PreviewFieldRole[]; blocks: PreviewFieldRole[] }> = {
  general: { rows: [], blocks: [] },
  message: { rows: ["recipients", "subject", "attachments"], blocks: ["body"] },
  file: { rows: ["path"], blocks: ["content"] },
  document_edit: { rows: ["document"], blocks: ["changes"] },
  event: { rows: ["subject", "time", "location", "attendees"], blocks: ["body"] },
};

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    maxHeight: "60vh",
    overflowY: "auto",
    padding: space.md,
    borderBottom: `${border.sm} solid ${color.line}`,
  },
  header: { display: "flex", alignItems: "center", gap: space.sm },
  icon: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: control.sm,
    height: control.sm,
    borderRadius: radius.sm,
    backgroundColor: color.panel2,
    color: color.accent,
  },
  heading: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
  title: { ...typography.ui, color: color.text, overflowWrap: "anywhere" },
  subtitle: { ...typography.caption, color: color.text3 },
  position: { ...typography.caption, flexShrink: 0, color: color.text3 },
  rows: { display: "grid", gridTemplateColumns: "max-content 1fr", gap: `${space.xs} ${space.md}`, margin: 0 },
  row: { display: "contents" },
  label: { ...typography.overline, paddingTop: space.xs, color: color.text3 },
  value: { ...typography.uiPlain, margin: 0, overflowWrap: "anywhere", color: color.text },
  strong: { fontWeight: fw.bold },
  blockWrap: { display: "flex", flexDirection: "column", gap: space.xs },
  block: {
    ...typography.uiPlain,
    margin: 0,
    maxHeight: size["2xs"],
    overflowY: "auto",
    padding: `${space.sm} ${space.sm}`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    lineHeight: lh.base,
    backgroundColor: color.codeBg,
    border: `${border.sm} solid ${color.lineSoft}`,
    borderRadius: radius.sm,
    color: color.text,
  },
  message: { backgroundColor: color.panel },
  code: { fontFamily: font.mono },
  summary: { ...typography.uiPlain, color: color.text2 },
  options: { display: "flex", flexDirection: "column", gap: space.xs },
  option: {
    display: "flex",
    alignItems: "center",
    gap: space.sm,
    minHeight: control.lg,
    padding: `${space.xs} ${space.md}`,
    textAlign: "left",
    border: `${border.sm} solid ${color.line}`,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    color: color.text,
    cursor: "pointer",
    ":hover:enabled": shorthands.borderColor(color.accent),
    ":focus-visible": { outline: `${border.md} solid ${color.accent}`, outlineOffset: border.sm },
  },
  picked: { backgroundColor: color.panel, ...shorthands.borderColor(color.accent) },
  mark: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: icon.sm,
    height: icon.sm,
    boxSizing: "border-box",
    border: `${border.sm} solid ${color.text3}`,
    color: color.btnFg,
  },
  radio: { borderRadius: "50%" },
  check: { borderRadius: radius.md },
  radioPicked: { border: `${border.lg} solid ${color.btnBg}` },
  checkPicked: { ...shorthands.borderColor(color.btnBg), backgroundColor: color.btnBg },
  optionText: { display: "flex", flexDirection: "column" },
  optionLabel: { ...typography.uiPlain },
  optionDescription: { ...typography.caption, color: color.text2 },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  end: { justifyContent: "flex-end" },
  stepper: { flexShrink: 0, display: "flex", alignItems: "center", gap: space.xs },
  arrow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: control.sm,
    height: control.sm,
    padding: 0,
    border: "none",
    borderRadius: radius.sm,
    backgroundColor: "transparent",
    color: color.text2,
    cursor: "pointer",
    ":hover:enabled": { backgroundColor: color.panel2, color: color.text },
    ":disabled": { color: color.text3, cursor: "default", opacity: opacity.disabled },
    ":focus-visible": { outline: `${border.md} solid ${color.accent}`, outlineOffset: border.sm },
  },
  fill: { flex: 1 },
  hint: { ...typography.caption, color: color.text3 },
  error: { ...typography.caption, color: color.danger },
  editor: { fontFamily: font.mono },
});

/**
 * The approval or question the conversation waits on, docked on top of the message box. The call
 * stays in the activity of its turn; this card only answers it.
 */
export function InteractionCard({ dock }: { dock: InteractionDock }) {
  const styles = useStyles();
  const current = dock.current;
  if (!current) {
    return null;
  }

  return (
    <section
      className={styles.card}
      aria-label={current.kind === "approval" ? current.preview.title : current.questions[dock.step]?.question}
    >
      {current.kind === "approval" ? (
        <ApprovalBody key={current.id} dock={dock} />
      ) : (
        <QuestionBody key={current.id} dock={dock} />
      )}
    </section>
  );
}

function Header({
  icon,
  title,
  subtitle,
  dock,
  stepper,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  dock: InteractionDock;
  stepper?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <div className={styles.header}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className={styles.heading}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
      {stepper}
      {!stepper && dock.count > 1 && (
        <span className={styles.position}>
          {dock.position} of {dock.count}
        </span>
      )}
    </div>
  );
}

function ApprovalBody({ dock }: { dock: InteractionDock }) {
  const styles = useStyles();
  const current = dock.current!;
  const original = current.kind === "approval" ? prettyJson(current.arguments) : "";
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(original);
  if (current.kind !== "approval") {
    return null;
  }

  const editedIsValid = !editing || isJsonObject(edited);
  const changed = editing && edited.trim() !== original.trim();
  const preview = current.preview;

  return (
    <>
      <Header
        icon={KIND_ICONS[preview.kind ?? "general"] ?? "tools"}
        title={preview.title}
        subtitle="Needs your approval"
        dock={dock}
      />
      <PreviewFields preview={preview} />
      {preview.allow_edit && (
        <>
          <Button appearance="subtle" size="small" disabled={dock.busy} onClick={() => setEditing((value) => !value)}>
            {editing ? "Hide arguments" : "Edit arguments"}
          </Button>
          {editing && (
            <Textarea
              className={styles.editor}
              value={edited}
              onChange={(_event, data) => setEdited(data.value)}
              rows={Math.min(16, Math.max(4, edited.split("\n").length))}
              spellCheck={false}
              disabled={dock.busy}
            />
          )}
        </>
      )}
      {dock.error && (
        <span className={styles.error} role="alert">
          {dock.error}
        </span>
      )}
      <div className={styles.actions}>
        <Button
          className={styles.fill}
          appearance="primary"
          disabled={dock.busy || !editedIsValid}
          onClick={() => void dock.approve(changed ? edited : undefined)}
        >
          Approve
        </Button>
        <Button className={styles.fill} disabled={dock.busy} onClick={() => void dock.reject()}>
          Reject
        </Button>
      </div>
      <span className={styles.hint}>Or write a message to do something else instead.</span>
    </>
  );
}

function QuestionBody({ dock }: { dock: InteractionDock }) {
  const styles = useStyles();
  const current = dock.current!;
  if (current.kind !== "question") {
    return null;
  }

  const count = current.questions.length;
  const question = current.questions[dock.step];
  const last = dock.step === count - 1;
  const multi = question.multi_select;
  const hasOptions = question.options.length > 0;
  const answered = dock.selected.length > 0 || dock.text.trim().length > 0;
  const subtitle = !hasOptions ? "Write your answer" : multi ? "Choose any" : "Pick one";

  const stepper = count > 1 && (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.arrow}
        aria-label="Previous question"
        title="Previous question"
        disabled={dock.busy || dock.step === 0}
        onClick={() => dock.goTo(dock.step - 1)}
      >
        <Icon name="chevronLeft" />
      </button>
      <span className={styles.position}>
        {dock.step + 1} of {count}
      </span>
      <button
        type="button"
        className={styles.arrow}
        aria-label="Next question"
        title="Next question"
        disabled={dock.busy || last}
        onClick={() => dock.goTo(dock.step + 1)}
      >
        <Icon name="chevron" />
      </button>
    </div>
  );

  return (
    <>
      <Header icon="question" title={question.question} subtitle={subtitle} dock={dock} stepper={stepper} />
      {hasOptions && (
        <div className={styles.options} role={multi ? "group" : "radiogroup"} aria-label={question.question}>
          {question.options.map((option) => {
            const picked = dock.selected.includes(option.label);
            return (
              <button
                key={option.label}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={picked}
                className={mergeClasses(styles.option, picked && styles.picked)}
                disabled={dock.busy}
                onClick={() => dock.toggleOption(option.label)}
              >
                <span
                  className={mergeClasses(
                    styles.mark,
                    multi ? styles.check : styles.radio,
                    picked && (multi ? styles.checkPicked : styles.radioPicked)
                  )}
                  aria-hidden="true"
                >
                  {picked && multi && <Icon name="check" />}
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.description && <span className={styles.optionDescription}>{option.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <Textarea
        key={dock.step}
        aria-label={hasOptions ? "Your own answer" : question.question}
        placeholder={hasOptions ? "Or write your own answer…" : "Write your answer…"}
        value={dock.text}
        onChange={(_event, data) => dock.setText(data.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && answered && !dock.busy) {
            event.preventDefault();
            void dock.next();
          }
        }}
        resize="vertical"
        rows={hasOptions ? 1 : 2}
        disabled={dock.busy}
      />
      {dock.error && (
        <span className={styles.error} role="alert">
          {dock.error}
        </span>
      )}
      <div className={mergeClasses(styles.actions, styles.end)}>
        <Button appearance="subtle" disabled={dock.busy} onClick={() => void dock.skip()}>
          Skip question
        </Button>
        <Button appearance="primary" disabled={dock.busy || !answered} onClick={() => void dock.next()}>
          {last ? "Send answers" : "Next"}
        </Button>
      </div>
    </>
  );
}

/**
 * The fields of a preview laid out for its kind: the kind's row fields first, then its block
 * fields, then every other field as a row, or as a block when it is multiline.
 */
function PreviewFields({ preview }: { preview: ApprovalPreview }) {
  const styles = useStyles();
  const layout = LAYOUTS[preview.kind ?? "general"] ?? LAYOUTS.general;
  const byRole = (roles: PreviewFieldRole[]) =>
    roles.flatMap((role) => preview.fields.filter((field) => field.role === role));
  const rows = byRole(layout.rows);
  const blocks = byRole(layout.blocks);
  const placed = new Set<ApprovalPreviewField>([...rows, ...blocks]);
  const rest = preview.fields.filter((field) => !placed.has(field));
  const allRows = [...rows, ...rest.filter((field) => !field.multiline)];
  const allBlocks = [...blocks, ...rest.filter((field) => field.multiline)];

  return (
    <>
      {preview.summary && <span className={styles.summary}>{preview.summary}</span>}
      {allRows.length > 0 && (
        <dl className={styles.rows}>
          {allRows.map((field, index) => (
            <div key={index} className={styles.row}>
              <dt className={styles.label}>{field.label}</dt>
              <dd className={mergeClasses(styles.value, field.role === "subject" && styles.strong)}>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {allBlocks.map((field, index) => (
        <div key={index} className={styles.blockWrap}>
          <span className={styles.label}>{field.label}</span>
          <div
            className={mergeClasses(
              styles.block,
              field.role === "body" && styles.message,
              field.role === "content" && styles.code
            )}
          >
            {field.value}
          </div>
        </div>
      ))}
    </>
  );
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
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
