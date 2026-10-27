import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { useSettings } from '../../hooks/useSettings';
import { getCodeblockTheme } from '../../utils/themeUtils';
import { helpActiveHeadingSignal } from '../../services/uiService';
import { DEFAULT_HELP_SECTION, HELP_SECTIONS, isHelpSection } from './helpSections';
import { parseHeadings, slugify } from './helpHeadings';
import { useHelpDoc } from './useHelpDoc';
import '../chat/ChatMessageMarkdown.css';
import './HelpPage.css';

/**
 * Blockquotes whose first paragraph is one of these markers render as callouts.
 * `[!NOT_IMPLEMENTED]` is a badge for a feature that is documented but not wired up yet.
 */
const CALLOUTS: Record<string, { kind: string; icon: IconName }> = {
  '[!TIP]': { kind: 'tip', icon: 'check' },
  '[!NOTE]': { kind: 'note', icon: 'info' },
  '[!WARNING]': { kind: 'warning', icon: 'shield' },
  '[!NOT_IMPLEMENTED]': { kind: 'not-implemented', icon: 'info' },
};

/** Image src that renders a screenshot placeholder box showing the alt text. */
const PLACEHOLDER_IMAGE_SRC = 'placeholder';

/** Inline code that names keys renders as keyboard keys: `Enter`, `Shift + Enter`, `Ctrl + V`. */
const KEY_NAME = '(Enter|Shift|Ctrl|Cmd|Alt|Esc|Escape|Tab|Space|[A-Z])';
const KEY_PATTERN = new RegExp(`^${KEY_NAME}(\\s*\\+\\s*${KEY_NAME})*$`);

const CODE_STYLES = { oneLight, atomDark } as const;

/** Distance from the top of the scroll container at which a heading counts as current. */
const SCROLL_SPY_OFFSET_PX = 96;

/** Plain text of a hast node. */
function nodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === 'text') return n.value ?? '';
  return (n.children ?? []).map(nodeText).join('');
}

/** Plain text of rendered React children. */
function childrenText(children: ReactNode): string {
  if (children == null || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(childrenText).join('');
  if (typeof children === 'object' && 'props' in children) {
    return childrenText((children as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function headingLine(node: unknown): number | undefined {
  const n = node as { position?: { start?: { line?: number } } } | undefined;
  return n?.position?.start?.line;
}

/** The blockquote's first paragraph as text, and everything after it. */
function splitFirstParagraph(children: ReactNode): { first: string; rest: ReactNode[] } {
  const items = (Array.isArray(children) ? children : [children])
    .filter(child => child != null && !(typeof child === 'string' && child.trim() === ''));
  const [first, ...rest] = items;
  return { first: childrenText(first).trim(), rest };
}

const HelpPage = () => {
  const { t } = useTranslation();
  const { section } = useParams<{ section?: string }>();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSection = isHelpSection(section) ? section : DEFAULT_HELP_SECTION;
  const sectionIndex = HELP_SECTIONS.indexOf(activeSection);
  const nextSection = HELP_SECTIONS[sectionIndex + 1];
  const doc = useHelpDoc(activeSection);

  const codeStyle = useMemo(() => {
    const name = getCodeblockTheme(settings.mode) as keyof typeof CODE_STYLES;
    return CODE_STYLES[name] ?? atomDark;
  }, [settings.mode]);

  const markdown = doc.status === 'ready' ? doc.markdown : '';
  const headings = useMemo(() => parseHeadings(markdown), [markdown]);
  const headingIds = useMemo(() => new Map(headings.map(h => [h.line, h.id])), [headings]);

  // Scroll after the markdown is in the DOM: to the hash target, or to the top on a new page.
  useEffect(() => {
    if (doc.status !== 'ready') return;
    const id = hash ? decodeURIComponent(hash.slice(1)) : '';
    const target = id ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView();
    } else if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [doc.status, hash, activeSection]);

  // Scroll spy: the last level-2 heading above the top of the viewport is the current one.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || doc.status !== 'ready') return;
    const ids = headings.filter(h => h.level === 2).map(h => h.id);

    const update = () => {
      const top = container.getBoundingClientRect().top + SCROLL_SPY_OFFSET_PX;
      let current: string | null = null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= top) current = id;
      }
      // At the very bottom the last heading may never reach the top; it is still the one in view.
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
      if (atBottom && ids.length > 0) current = ids[ids.length - 1];
      helpActiveHeadingSignal.value = current;
    };

    update();
    container.addEventListener('scroll', update, { passive: true });
    return () => {
      container.removeEventListener('scroll', update);
      helpActiveHeadingSignal.value = null;
    };
  }, [doc.status, headings]);

  const components = useMemo<Components>(() => {
    const headingId = (node: unknown) => {
      const line = headingLine(node);
      return (line !== undefined && headingIds.get(line)) || slugify(nodeText(node)) || 'section';
    };

    const copyCode = (code: string) => {
      navigator.clipboard.writeText(code)
        .catch(err => console.error('Failed to copy code:', err));
    };

    return {
      h2({ node, children }) {
        return <h2 id={headingId(node)}>{children}</h2>;
      },
      h3({ node, children }) {
        return <h3 id={headingId(node)}>{children}</h3>;
      },
      a({ href, children }) {
        const url = href ?? '';
        const isInternal = url.startsWith('/') || url.startsWith('#');
        if (isInternal) {
          return (
            <a
              href={url}
              onClick={(e) => {
                e.preventDefault();
                navigate(url.startsWith('#') ? { hash: url } : url);
              }}
            >
              {children}
            </a>
          );
        }
        return <a href={url} target="_blank" rel="noopener noreferrer">{children}</a>;
      },
      img({ src, alt }) {
        if (src === PLACEHOLDER_IMAGE_SRC) {
          return (
            <span className="help-screenshot" role="img" aria-label={alt ?? ''}>
              <span className="help-screenshot-bar" aria-hidden="true">
                <span /><span /><span />
              </span>
              <span className="help-screenshot-body">
                <Icon name="file" size={1.5} />
                <span className="t-caption">{alt}</span>
              </span>
            </span>
          );
        }
        return <img src={src} alt={alt ?? ''} loading="lazy" />;
      },
      blockquote({ children }) {
        const { first, rest } = splitFirstParagraph(children);
        const callout = CALLOUTS[first];
        if (!callout) {
          return <blockquote>{children}</blockquote>;
        }
        if (callout.kind === 'not-implemented') {
          return (
            <div className="help-not-implemented t-caption-strong">
              <Icon name={callout.icon} size={0.875} />
              {t('help.notImplemented')}
            </div>
          );
        }
        return (
          <aside className={`help-callout help-callout-${callout.kind}`}>
            <div className="help-callout-label t-caption-strong">
              <Icon name={callout.icon} size={0.9375} />
              {t(`help.callouts.${callout.kind}`)}
            </div>
            <div className="help-callout-body">{rest}</div>
          </aside>
        );
      },
      code({ className, children }) {
        const match = /language-(\w+)/.exec(className ?? '');
        if (!match) {
          const text = childrenText(children);
          if (KEY_PATTERN.test(text)) {
            const keys = text.split('+').map(k => k.trim());
            return (
              <span className="help-keys">
                {keys.map((key, index) => (
                  <span key={index}>
                    {index > 0 && <span className="help-keys-plus">+</span>}
                    <kbd className="t-caption-strong">{key}</kbd>
                  </span>
                ))}
              </span>
            );
          }
          return <code className={className}>{children}</code>;
        }
        const language = match[1];
        const codeText = String(children).replace(/\n$/, '');
        return (
          <div className="code-block-wrapper">
            <div className="code-block-header">
              <span className="language-name t-overline">{language}</span>
              <button
                className="copy-code-button t-caption-strong"
                onClick={() => copyCode(codeText)}
                title={t('chat.actions.copyCode')}
              >
                <Icon name="copy" size={1} /> {t('chat.actions.copyCode')}
              </button>
            </div>
            <SyntaxHighlighter style={codeStyle} language={language}>
              {codeText}
            </SyntaxHighlighter>
          </div>
        );
      },
    };
  }, [codeStyle, headingIds, navigate, t]);

  return (
    <div className="help-page" ref={containerRef}>
      <div className="help-page-content">
        <header className="help-header">
          <div className="help-kicker t-overline">
            {t('help.partOf', { n: sectionIndex + 1, total: HELP_SECTIONS.length })}
          </div>
          <h1 className="t-page-title">{t(`help.sections.${activeSection}`)}</h1>
          <div className="page-title-bar" />
          <p className="help-lead t-lead">{t(`help.descriptions.${activeSection}`)}</p>
        </header>

        {doc.status === 'loading' && (
          <p className="help-status t-body">{t('help.loading')}</p>
        )}
        {doc.status === 'error' && (
          <p className="help-status t-body">{t('help.loadError')}</p>
        )}
        {doc.status === 'ready' && (
          <>
            <div className="message-content help-doc">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={components}
              >
                {doc.markdown}
              </ReactMarkdown>
            </div>

            {nextSection && (
              <button className="help-next" onClick={() => navigate(`/help/${nextSection}`)}>
                <span className="help-next-text">
                  <span className="help-next-label t-overline">
                    {t('help.next', { n: sectionIndex + 2 })}
                  </span>
                  <span className="help-next-title t-title">{t(`help.sections.${nextSection}`)}</span>
                  <span className="help-next-description t-caption">{t(`help.descriptions.${nextSection}`)}</span>
                </span>
                <Icon name="arrowUp" size={1.25} className="help-next-arrow" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HelpPage;
