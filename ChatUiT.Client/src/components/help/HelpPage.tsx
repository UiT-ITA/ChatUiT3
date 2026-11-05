import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import Button from '../common/Button';
import { helpActiveHeadingSignal } from '../../services/uiService';
import { DEFAULT_HELP_SECTION, HELP_SECTIONS, isHelpSection } from './helpSections';
import { parseHeadings, slugify } from './helpHeadings';
import { useHelpDoc } from './useHelpDoc';
import CodeBlock from '../common/CodeBlock';
import CodeHighlighter from '../common/CodeHighlighter';
import Card from '../common/Card';
import Stack from '../common/Stack';
import Badge from '../common/Badge';
import Alert from '../common/Alert';
import PageTitleBar from '../common/PageTitleBar';
import Page, { PageIntro } from '../common/Page';
import Text from '../common/Text';
import Box from '../common/Box';
import RichText, { RichTextLink } from '../common/RichText';
import KeyCombo from '../common/KeyCombo';

/**
 * Blockquotes whose first paragraph is one of these markers render as callouts.
 * `[!NOT_IMPLEMENTED]` is a badge for a feature that is documented but not wired up yet.
 */
const CALLOUTS: Record<string, { kind: 'tip' | 'note' | 'warning' | 'not-implemented'; icon: IconName }> = {
  '[!TIP]': { kind: 'tip', icon: 'check' },
  '[!NOTE]': { kind: 'note', icon: 'info' },
  '[!WARNING]': { kind: 'warning', icon: 'shield' },
  '[!NOT_IMPLEMENTED]': { kind: 'not-implemented', icon: 'info' },
};

/** Image src of a screenshot that is not made yet. Such images are left out. */
const PLACEHOLDER_IMAGE_SRC = 'placeholder';

/** Inline code that names keys renders as keyboard keys: `Enter`, `Shift + Enter`, `Ctrl + V`. */
const KEY_NAME = '(Enter|Shift|Ctrl|Cmd|Alt|Esc|Escape|Tab|Space|[A-Z])';
const KEY_PATTERN = new RegExp(`^${KEY_NAME}(\\s*\\+\\s*${KEY_NAME})*$`);

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
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSection = isHelpSection(section) ? section : DEFAULT_HELP_SECTION;
  const sectionIndex = HELP_SECTIONS.indexOf(activeSection);
  const nextSection = HELP_SECTIONS[sectionIndex + 1];
  const doc = useHelpDoc(activeSection);

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
      // Above the first heading, the first heading is the current one.
      if (current === null && ids.length > 0) current = ids[0];
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
      const line = (node as { position?: { start?: { line?: number } } } | undefined)?.position?.start?.line;
      return (line !== undefined && headingIds.get(line)) || slugify(nodeText(node)) || 'section';
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
        return <RichTextLink href={url} target="_blank" rel="noopener noreferrer">{children}</RichTextLink>;
      },
      img({ src, alt }) {
        if (src === PLACEHOLDER_IMAGE_SRC) return null;
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
            <Box mt="xl">
              <Badge variant="solid" tone="warning" size="medium" icon={callout.icon}>{t('help.notImplemented')}</Badge>
            </Box>
          );
        }
        return (
          <Alert tone={callout.kind} icon={callout.icon} title={t(`help.callouts.${callout.kind}`)} my="xl">
            {rest}
          </Alert>
        );
      },
      code({ className, children }) {
        const match = /language-(\w+)/.exec(className ?? '');
        if (!match) {
          const text = childrenText(children);
          if (KEY_PATTERN.test(text)) {
            return <KeyCombo keys={text.split('+').map(k => k.trim())} />;
          }
          return <code className={className}>{children}</code>;
        }
        const language = match[1];
        const codeText = String(children).replace(/\n$/, '');
        return (
          <CodeBlock
            label={language}
            wrap
            actions={(
              <Button
                variant="ghost"
                size="small"
                startIcon="copy"
                onClick={() => navigator.clipboard.writeText(codeText).catch(err => console.error('Failed to copy code:', err))}
                title={t('chat.actions.copyCode')}
              >
                {t('chat.actions.copyCode')}
              </Button>
            )}
          >
            <CodeHighlighter code={codeText} language={language} />
          </CodeBlock>
        );
      },
    };
  }, [headingIds, navigate, t]);

  return (
    <Page fill="grow" flow="block" mobileEndSpace="large" ref={containerRef}>
      <Box as="header" mb="xl">
        <Text as="div" variant="overline" tone="accent" mb="sm">
          {t('help.partOf', { n: sectionIndex + 1, total: HELP_SECTIONS.length })}
        </Text>
        <Text as="h1" variant="page-title">{t(`help.sections.${activeSection}`)}</Text>
        <PageTitleBar />
        <PageIntro size="large" mb="none" maxWidth="none">{t(`help.descriptions.${activeSection}`)}</PageIntro>
      </Box>

      {doc.status !== 'ready' && (
        <Text as="p" variant="body" tone="secondary">{t(doc.status === 'loading' ? 'help.loading' : 'help.loadError')}</Text>
      )}
      {doc.status === 'ready' && (
        <>
          <RichText document>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={components}
            >
              {doc.markdown}
            </ReactMarkdown>
          </RichText>

          {nextSection && (
            <Card as="button" elevated accent="start" padding="lg" mt="2xl" width="full" onClick={() => navigate(`/help/${nextSection}`)}>
              <Stack direction="row" align="center" justify="between" gap="lg">
                <Stack gap="xs">
                  <Text variant="overline" tone="accent">
                    {t('help.next', { n: sectionIndex + 2 })}
                  </Text>
                  <Text as="span" variant="title">{t(`help.sections.${nextSection}`)}</Text>
                  <Text variant="caption" tone="secondary">{t(`help.descriptions.${nextSection}`)}</Text>
                </Stack>
                <Icon name="arrowUp" size="md" color="accent" rotate={90} />
              </Stack>
            </Card>
          )}
        </>
      )}
    </Page>
  );
};

export default HelpPage;
