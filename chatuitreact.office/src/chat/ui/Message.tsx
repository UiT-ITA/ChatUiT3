import { makeStyles } from "@fluentui/react-components";
import { Marked } from "marked";
import { useMemo, type ReactNode } from "react";
import { AssistantMeta } from "./AssistantMeta";
import { color, font, fontSize, radius, typography } from "./tokens";

const markdown = new Marked({
  gfm: true,
  renderer: {
    // Raw HTML from the model is shown as text, never rendered.
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, tokens: children }) {
      const inner = this.parser.parseInline(children);
      const safe = /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;
      return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
    },
    image({ text }) {
      return escapeHtml(text);
    },
  },
});

const useStyles = makeStyles({
  user: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem" },
  files: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "0.375rem", maxWidth: "85%" },
  file: {
    ...typography.caption,
    maxWidth: "100%",
    padding: "0.125rem 0.5rem",
    border: `1px solid ${color.line}`,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    color: color.text2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  userContent: {
    ...typography.chat,
    lineHeight: 1.5,
    maxWidth: "85%",
    padding: "0.6875rem 0.875rem",
    backgroundColor: color.panel2,
    border: `1px solid ${color.line}`,
    borderRadius: radius.md,
    color: color.text,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  assistant: { display: "flex", flexDirection: "column", alignItems: "stretch" },
  assistantContent: {
    ...typography.chat,
    color: color.text,
    overflowWrap: "anywhere",
    "& > :first-child": { marginTop: 0 },
    "& > :last-child": { marginBottom: 0 },
    "& p": { marginTop: "0.75rem", marginBottom: "0.75rem", lineHeight: 1.7 },
    "& p + p": { marginTop: "0.375rem" },
    "& :is(h1, h2, h3, h4, h5, h6)": {
      marginTop: "1.5rem",
      marginBottom: "0.5rem",
      lineHeight: 1.2,
      letterSpacing: "-0.01em",
      color: color.text,
    },
    "& h1": { fontSize: fontSize.h1 },
    "& h2": { fontSize: fontSize.h2 },
    "& h3": { fontSize: fontSize.h3 },
    "& h4": { fontSize: fontSize.titleSm },
    "& :is(ul, ol)": { marginTop: "0.75rem", marginBottom: "0.75rem", paddingLeft: "1.5rem" },
    "& li": { marginTop: "0.25rem", marginBottom: "0.25rem" },
    "& li :is(ul, ol)": { marginTop: "0.25rem", marginBottom: "0.25rem" },
    "& ol > li::marker": { fontFamily: font.mono, fontSize: fontSize.ui, fontWeight: 600, color: color.accent },
    "& table": {
      borderCollapse: "collapse",
      width: "100%",
      marginTop: "1rem",
      marginBottom: "1rem",
      fontSize: fontSize.table,
    },
    "& th": {
      borderBottom: `2px solid ${color.brand}`,
      padding: "0.4375rem 0.625rem",
      textAlign: "left",
      fontWeight: 700,
    },
    "& td": { borderBottom: `1px solid ${color.lineSoft}`, padding: "0.5rem 0.625rem", color: color.text2 },
    "& td:first-child": { color: color.text, fontWeight: 600 },
    "& :not(pre) > code": {
      fontFamily: font.mono,
      fontSize: fontSize.ui,
      backgroundColor: color.codeBg,
      border: `1px solid ${color.lineSoft}`,
      borderRadius: radius.sm,
      padding: "0.0625rem 0.3125rem",
    },
    "& pre": {
      ...typography.code,
      marginTop: "0.625rem",
      marginBottom: "0.625rem",
      padding: "0.75rem",
      overflowX: "auto",
      backgroundColor: color.codeBg,
      border: `1px solid ${color.line}`,
      borderRadius: radius.md,
    },
    "& blockquote": {
      marginTop: "0.75rem",
      marginBottom: "0.75rem",
      marginLeft: 0,
      marginRight: 0,
      padding: "0.125rem 0 0.125rem 0.875rem",
      borderLeft: `3px solid ${color.accent2}`,
      color: color.text2,
    },
    "& hr": { border: "none", borderTop: `1px solid ${color.line}`, marginTop: "1.25rem", marginBottom: "1.25rem" },
    "& a": { color: color.accent, textDecoration: "underline", textUnderlineOffset: "0.125rem" },
    "& a:hover": { color: color.brand },
    "& a::after": { content: '"↗"', marginLeft: "0.25rem", opacity: 0.8, fontSize: "0.85em" },
  },
});

export interface MessageProps {
  role: "user" | "assistant";
  text: string;
  /** The names of the files attached to a user message. */
  files?: string[];
  /** Replaces the assistant's meta row, for example with the turn's collapsed activity. */
  meta?: ReactNode;
}

/** One chat message. Assistant messages are rendered as Markdown under the assistant's name. */
export function Message({ role, text, files = [], meta }: MessageProps) {
  const styles = useStyles();
  const html = useMemo(() => (role === "assistant" ? renderMarkdown(text) : null), [role, text]);

  if (html === null) {
    return (
      <div className={styles.user}>
        {text && <div className={styles.userContent}>{text}</div>}
        {files.length > 0 && (
          <div className={styles.files}>
            {files.map((name, index) => (
              <span key={index} className={styles.file} title={name}>
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={styles.assistant}>
      {meta ?? <AssistantMeta />}
      <div className={styles.assistantContent} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** Renders model Markdown to HTML. Raw HTML is escaped and only http, https and mailto links are kept. */
export function renderMarkdown(text: string): string {
  return markdown.parse(text, { async: false }) as string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
