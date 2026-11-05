import { makeStyles } from "@fluentui/react-components";
import { Marked } from "marked";
import { useMemo, type ReactNode } from "react";
import { color, font, space, fs, fw, lh, radius, border, size, typography } from "./tokens";

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
  user: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: space.sm },
  files: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: space.sm,
    maxWidth: `min(${size.md}, 85%)`,
  },
  file: {
    ...typography.caption,
    maxWidth: "100%",
    padding: `${space.xs} ${space.sm}`,
    border: `${border.sm} solid ${color.line}`,
    borderRadius: radius.sm,
    backgroundColor: color.panel,
    color: color.text2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  userContent: {
    ...typography.chat,
    maxWidth: `min(${size.md}, 85%)`,
    padding: `${space.sm} ${space.md}`,
    backgroundColor: color.sel,
    borderRadius: radius.lg,
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
    "& p": { marginTop: space.md, marginBottom: space.md, lineHeight: lh.base },
    "& p + p": { marginTop: space.sm },
    "& :is(h1, h2, h3, h4, h5, h6)": {
      marginTop: space.xl,
      marginBottom: space.sm,
      lineHeight: lh.tight,
      color: color.text,
    },
    "& h1": { fontSize: fs.xl },
    "& h2": { fontSize: fs.lg },
    "& h3": { fontSize: fs.lg },
    "& h4": { fontSize: fs.md },
    "& :is(ul, ol)": { marginTop: space.md, marginBottom: space.md, paddingLeft: space.xl },
    "& li": { marginTop: space.xs, marginBottom: space.xs },
    "& li :is(ul, ol)": { marginTop: space.xs, marginBottom: space.xs },
    "& ol > li::marker": { fontFamily: font.mono, fontSize: fs.md, fontWeight: fw.bold, color: color.accent },
    "& table": {
      borderCollapse: "collapse",
      width: "100%",
      marginTop: space.lg,
      marginBottom: space.lg,
      fontSize: fs.md,
    },
    "& th": {
      borderBottom: `${border.md} solid ${color.brand}`,
      padding: `${space.sm} ${space.md}`,
      textAlign: "left",
      fontWeight: fw.bold,
    },
    "& td": {
      borderBottom: `${border.sm} solid ${color.lineSoft}`,
      padding: `${space.sm} ${space.md}`,
      color: color.text2,
    },
    "& td:first-child": { color: color.text, fontWeight: fw.bold },
    "& :not(pre) > code": {
      fontFamily: font.mono,
      fontSize: fs.md,
      backgroundColor: color.codeBg,
      border: `${border.sm} solid ${color.lineSoft}`,
      borderRadius: radius.sm,
      padding: `0 ${space.xs}`,
    },
    "& pre": {
      ...typography.code,
      marginTop: space.md,
      marginBottom: space.md,
      padding: space.md,
      overflowX: "auto",
      backgroundColor: color.codeBg,
      border: `${border.sm} solid ${color.line}`,
      borderRadius: radius.md,
    },
    "& blockquote": {
      marginTop: space.md,
      marginBottom: space.md,
      marginLeft: 0,
      marginRight: 0,
      padding: `${space.xs} 0 ${space.xs} ${space.lg}`,
      borderLeft: `${border.lg} solid ${color.accent2}`,
      color: color.text2,
    },
    "& hr": {
      border: "none",
      borderTop: `${border.sm} solid ${color.line}`,
      marginTop: space.xl,
      marginBottom: space.xl,
    },
    "& a": { color: color.accent, textDecoration: "underline", textUnderlineOffset: space.xs },
    "& a:hover": { color: color.brand },
    "& a::after": { content: '"↗"', marginLeft: space.xs, fontSize: fs.sm },
  },
});

export interface MessageProps {
  role: "user" | "assistant";
  text: string;
  /** The names of the files attached to a user message. */
  files?: string[];
  /** Shown above an assistant message, for example the turn's collapsed activity. */
  meta?: ReactNode;
}

/** One chat message. Assistant messages are rendered as Markdown. */
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
      {meta}
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
