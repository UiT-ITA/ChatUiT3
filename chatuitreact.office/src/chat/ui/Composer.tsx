/* global File, HTMLFormElement, HTMLInputElement, HTMLTextAreaElement */

import { makeStyles, shorthands, Spinner } from "@fluentui/react-components";
import { useRef, useState, type ClipboardEvent, type ComponentType, type DragEvent, type KeyboardEvent } from "react";
import type { ChatFile } from "../files/fileModels";
import { MAX_FILES } from "../files/filePart";
import { getSupportedImportKind, SUPPORTED_IMPORT_ACCEPT } from "../files/kinds";
import { readFile } from "../files/readFile";
import { Icon } from "./icons";
import { ToolbarButton } from "./ToolbarButton";
import { color, fontSize, radius, shadowCard, typography } from "./tokens";

export interface ComposerProps {
  /** App-specific controls, shown left of the send button. */
  Settings?: ComponentType;
  /** True while a response streams or tools run. Sending is blocked and Stop is shown. */
  busy: boolean;
  onNewChat(): void;
  onSend(text: string, files: ChatFile[]): void;
  onStop(): void;
}

const useStyles = makeStyles({
  root: { padding: "0.625rem 0.875rem 0.875rem", backgroundColor: color.bg },
  card: {
    border: `1px solid ${color.line}`,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    boxShadow: shadowCard,
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    maxHeight: "12.5rem",
    padding: "0.75rem 0.875rem 0.375rem",
    border: "none",
    outline: "none",
    resize: "none",
    backgroundColor: "transparent",
    fontFamily: "inherit",
    fontSize: fontSize.titleSm,
    lineHeight: 1.55,
    color: color.text,
    "::placeholder": { color: color.text3 },
  },
  toolbar: { display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.25rem 0.5rem 0.5rem" },
  files: { display: "flex", flexWrap: "wrap", gap: "0.375rem", padding: "0.625rem 0.875rem 0" },
  file: {
    ...typography.caption,
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    maxWidth: "100%",
    padding: "0.125rem 0.25rem 0.125rem 0.5rem",
    border: `1px solid ${color.line}`,
    borderRadius: radius.sm,
    backgroundColor: color.panel2,
    color: color.text,
  },
  fileName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  remove: {
    display: "flex",
    padding: "0.125rem",
    border: "none",
    borderRadius: radius.sm,
    backgroundColor: "transparent",
    color: color.text2,
    cursor: "pointer",
    ":hover": { color: color.text },
  },
  notice: { ...typography.caption, color: color.text2, padding: "0.375rem 0.875rem 0" },
  hidden: { display: "none" },
  spacer: { flex: 1 },
  send: {
    ...typography.ui,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "2rem",
    padding: "0 0.875rem",
    border: `2px solid ${color.btnBg}`,
    borderRadius: radius.md,
    backgroundColor: color.btnBg,
    color: color.btnFg,
    cursor: "pointer",
    ":hover:enabled": { backgroundColor: color.btnHover, ...shorthands.borderColor(color.btnHover) },
    ":disabled": { opacity: 0.5, cursor: "not-allowed" },
  },
});

export function Composer({ Settings, busy, onNewChat, onSend, onStop }: ComposerProps) {
  const styles = useStyles();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [reading, setReading] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const canSend = !busy && reading === 0 && (text.trim().length > 0 || files.length > 0);

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(text, files);
    setText("");
    setFiles([]);
    setNotice(null);
  };

  // As in ChatUiT's chat: unsupported files and files that cannot be read are named, the rest are added, up to
  // MAX_FILES.
  const addFiles = async (added: File[]) => {
    if (added.length === 0) {
      return;
    }
    const problems = added
      .filter((file) => getSupportedImportKind(file) === null)
      .map((file) => `${file.name}: this file type is not supported.`);
    const supported = added.filter((file) => getSupportedImportKind(file) !== null);
    setNotice(null);
    setReading((count) => count + supported.length);
    const results = await Promise.allSettled(supported.map(readFile));
    setReading((count) => count - supported.length);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const reason = result.reason instanceof Error ? result.reason.message : "it could not be read";
        problems.push(`${supported[index].name}: ${reason}`);
      }
    });
    const read = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    if (files.length + read.length > MAX_FILES) {
      problems.push(`At most ${MAX_FILES} files can go with one message.`);
    }
    setFiles((current) => [...current, ...read].slice(0, MAX_FILES));
    setNotice(problems.length > 0 ? problems.join(" ") : null);
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length > 0) {
      event.preventDefault();
      void addFiles(pasted);
    }
  };

  const onDrop = (event: DragEvent<HTMLFormElement>) => {
    if (event.dataTransfer.files.length > 0) {
      event.preventDefault();
      void addFiles(Array.from(event.dataTransfer.files));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      className={styles.root}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className={styles.card}>
        {(files.length > 0 || reading > 0) && (
          <div className={styles.files}>
            {files.map((file) => (
              <span key={file.id} className={styles.file} title={file.sourceFilename}>
                <span className={styles.fileName}>{file.sourceFilename}</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${file.sourceFilename}`}
                  title="Remove"
                  onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}
                >
                  <Icon name="close" size={0.75} />
                </button>
              </span>
            ))}
            {reading > 0 && (
              <Spinner size="extra-tiny" label={{ children: "Reading files…", className: styles.file }} />
            )}
          </div>
        )}
        {notice && <div className={styles.notice}>{notice}</div>}
        <textarea
          className={styles.input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="Ask ChatUiT…"
          rows={2}
        />
        <input
          ref={picker}
          type="file"
          multiple
          accept={SUPPORTED_IMPORT_ACCEPT}
          className={styles.hidden}
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <div className={styles.toolbar}>
          <ToolbarButton icon="attach" label="Attach file" onClick={() => picker.current?.click()} />
          {Settings && <Settings />}
          <span className={styles.spacer} />
          <ToolbarButton icon="chatNew" label="New chat" onClick={onNewChat} />
          {busy ? (
            <button type="button" className={styles.send} onClick={onStop} aria-label="Stop" title="Stop">
              <Icon name="stop" size={0.9375} />
            </button>
          ) : (
            <button type="submit" className={styles.send} disabled={!canSend} aria-label="Send" title="Send">
              <Icon name="send" size={0.9375} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
