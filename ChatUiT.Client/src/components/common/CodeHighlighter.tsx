import type { CSSProperties, ReactNode } from 'react';
import { Prism as SyntaxHighlighter, createElement, type SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { scrollFadeClass } from './scrollFade';
import './CodeBlock.css';

interface CodeHighlighterProps {
  code: string;
  language: string;
  // Wraps long lines instead of scrolling sideways
  wrap?: boolean;
}

type RendererProps = Parameters<NonNullable<SyntaxHighlighterProps['renderer']>>[0];
type RendererNode = RendererProps['rows'][number];

/** Tab width in characters, the same as tab-size in CodeBlock.css. */
const TAB_SIZE = 4;

const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh', 'console']);

/** Language of a heredoc body, by its delimiter. */
const DELIMITER_LANGUAGE: Record<string, string> = {
  PY: 'python',
  PYTHON: 'python',
  JS: 'javascript',
  NODE: 'javascript',
  TS: 'typescript',
  SQL: 'sql',
  JSON: 'json',
  YAML: 'yaml',
  YML: 'yaml',
  HTML: 'markup',
  XML: 'markup',
  CSS: 'css',
};

/** Language of a heredoc body, by the file extension it is written to. */
const EXTENSION_LANGUAGE: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  sh: 'bash',
  html: 'markup',
  xml: 'markup',
  css: 'css',
  cs: 'csharp',
};

const HEREDOC_START = /<<(-?)\s*(['"]?)([A-Za-z_]\w*)\2/;

function heredocLanguage(commandLine: string, delimiter: string): string {
  const byDelimiter = DELIMITER_LANGUAGE[delimiter.toUpperCase()];
  if (byDelimiter) return byDelimiter;
  if (/\bpython\d*(\.\d+)?\b/.test(commandLine)) return 'python';
  if (/\b(node|deno|bun)\b/.test(commandLine)) return 'javascript';
  if (/\b(psql|sqlite3|mysql)\b/.test(commandLine)) return 'sql';
  const target = />\s*["']?[^\s"']+\.(\w+)/.exec(commandLine);
  return (target && EXTENSION_LANGUAGE[target[1].toLowerCase()]) || 'text';
}

/** Splits a shell script into shell parts and heredoc bodies, each with its own language. */
function splitCodeSegments(code: string, language: string) {
  if (!SHELL_LANGUAGES.has(language.toLowerCase())) return [{ code, language }];
  const lines = code.split('\n');
  const segments: { code: string; language: string }[] = [];
  // Adds lines from up to to, ending with a line break unless they end the code
  const push = (from: number, to: number, segmentLanguage: string) => {
    const text = lines.slice(from, to).join('\n');
    if (to > from) segments.push({ code: to < lines.length ? `${text}\n` : text, language: segmentLanguage });
  };
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const heredoc = HEREDOC_START.exec(lines[i]);
    if (!heredoc) continue;
    const [, dash, , delimiter] = heredoc;
    const end = lines.findIndex((line, j) => j > i && (dash ? line.trim() : line) === delimiter);
    if (end === -1) continue;
    push(start, i + 1, language);
    push(i + 1, end, heredocLanguage(lines[i], delimiter));
    start = end;
    i = end - 1;
  }
  push(start, lines.length, language);
  return segments;
}

function Passthrough({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/** The width of a line's leading whitespace in characters, with each tab as TAB_SIZE characters. */
function indentWidth(line: string): number {
  const leading = /^[ \t]*/.exec(line)?.[0] ?? '';
  return leading.replace(/\t/g, ' '.repeat(TAB_SIZE)).length;
}

function nodeText(node: RendererNode): string {
  if (node.type === 'text') return String(node.value ?? '');
  return (node.children ?? []).map(nodeText).join('');
}

/** Renders each line as a span of class code-line with its indentation width in --indent, for a hanging indent when lines wrap. */
function renderLines({ rows, stylesheet, useInlineStyles }: RendererProps) {
  return rows.map((row, index) => {
    const node: RendererNode = {
      ...row,
      properties: {
        ...row.properties,
        className: [...(row.properties?.className ?? []), 'code-line'],
        style: { '--indent': `${indentWidth(nodeText(row))}ch` } as CSSProperties,
      },
    };
    return createElement({ node, stylesheet, useInlineStyles, key: index });
  });
}

/** Highlighted code, with shell heredoc bodies highlighted in their own language. Token colours come from CodeBlock.css. */
function CodeHighlighter({ code, language, wrap = false }: CodeHighlighterProps) {
  const segments = splitCodeSegments(code, language);
  const preClass = scrollFadeClass('x');

  if (segments.length === 1) {
    return (
      <SyntaxHighlighter
        useInlineStyles={false}
        language={language}
        className={preClass}
        codeTagProps={{ className: `language-${language}` }}
        wrapLines
        wrapLongLines={wrap}
        renderer={renderLines}
      >
        {code}
      </SyntaxHighlighter>
    );
  }

  return (
    <pre className={`language-${language} ${preClass}`}>
      <code className={`language-${language}`}>
        {segments.map((segment, index) => (
          <SyntaxHighlighter
            key={index}
            useInlineStyles={false}
            language={segment.language}
            PreTag={Passthrough}
            CodeTag={Passthrough}
            wrapLines
            renderer={renderLines}
          >
            {segment.code}
          </SyntaxHighlighter>
        ))}
      </code>
    </pre>
  );
}

export default CodeHighlighter;
