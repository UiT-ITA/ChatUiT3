import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import mermaid from 'mermaid';
import { useTranslation } from 'react-i18next';
import { tokenValue as token } from '../../utils/cssTokens';
import { Icon } from './Icon';
import { cx } from './layout';
import { scrollFadeClass } from './scrollFade';
import './MermaidDiagram.css';

// Mermaid theme variables and the app tokens they take their colour from. Mermaid derives the other variables from these.
const THEME_TOKENS: Record<string, string> = {
  background: '--code-bg',
  edgeLabelBackground: '--code-bg',
  sequenceNumberColor: '--code-bg',
  primaryColor: '--surface-raised',
  primaryTextColor: '--text',
  primaryBorderColor: '--accent',
  secondaryColor: '--panel-2',
  secondaryTextColor: '--text',
  secondaryBorderColor: '--line-strong',
  tertiaryColor: '--tint',
  tertiaryTextColor: '--text',
  tertiaryBorderColor: '--line',
  lineColor: '--text-2',
  nodeBorder: '--accent',
  noteBkgColor: '--info-soft',
  noteTextColor: '--text',
  noteBorderColor: '--line-strong',
  actorLineColor: '--text-3',
  labelBoxBkgColor: '--panel-2',
  labelBoxBorderColor: '--line-strong',
  activationBorderColor: '--accent',
};

// Line, label and number styles, added after Mermaid's own styles inside the diagram
const diagramCss = (dark: boolean) => `
  .sequenceNumber {
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }
  .messageLine0, .messageLine1, .flowchart-link { stroke-width: var(--border-md); }
  .messageLine1, .actor-line, .loopLine { stroke: var(${dark ? '--text-2' : '--text'}); }
  .actor-line, .loopLine, .labelBox { stroke-width: var(--border-sm); }
  .labelBox { filter: none; }
  ${dark ? '.messageLine1 { stroke-dasharray: var(--space-xs); }' : ''}
  .loopLine { stroke-dasharray: ${dark ? 'var(--space-sm) var(--space-xs)' : 'var(--space-xs)'}; }
  .note {
    fill: var(${dark ? '--surface-raised' : '--info-soft'});
    stroke: var(--text-3);
  }
`;

/** Sets Mermaid's theme and sizes from the current tokens. */
function initializeMermaid() {
  const darkMode = document.documentElement.dataset.mode === 'dark';
  const fontFamily = token('--font-sans');
  const themeVariables = Object.fromEntries(Object.entries(THEME_TOKENS).map(([name, tokenName]) => [name, token(tokenName)]));
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: { ...themeVariables, darkMode, fontFamily, signalColor: token(darkMode ? '--text' : '--text-2') },
    themeCSS: diagramCss(darkMode),
    fontFamily,
    htmlLabels: false,
    flowchart: { useMaxWidth: false },
    sequence: {
      useMaxWidth: false,
      wrap: true,
    },
  });
}

/** Escapes semicolons in the text of sequence diagram lines, where Mermaid reads them as statement ends. */
function escapeSequenceSemicolons(chart: string): string {
  if (!/^\s*sequenceDiagram\b/.test(chart)) return chart;
  return chart.split('\n').map(line => line.replace(/(:.*)/, text => text.replace(/;/g, '#59;'))).join('\n');
}

const APPEARANCE_ATTRIBUTES = ['data-mode', 'data-theme', 'data-size'];

function subscribeAppearance(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: APPEARANCE_ATTRIBUTES });
  return () => observer.disconnect();
}

const appearanceSnapshot = () => APPEARANCE_ATTRIBUTES.map(name => document.documentElement.getAttribute(name) ?? '').join('|');

interface MermaidDiagramProps {
  chart: string;
  // Shows the diagram at its natural width, scrolling sideways when wider than the block; otherwise it is scaled down to the block width
  fullSize?: boolean;
  // Always shows the scrollbar of a diagram wider than the block, with a wider fade at the cut edge
  showScrollbar?: boolean;
}

function MermaidDiagram({ chart, fullSize = false, showScrollbar = false }: MermaidDiagramProps) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // The resolved mode, theme and text size on the page root
  const appearance = useSyncExternalStore(subscribeAppearance, appearanceSnapshot);
  const { t } = useTranslation();

  // Render the diagram when the chart, the resolved theme or mode, or the text size changes
  useEffect(() => {
    let cancelled = false;
    const container = document.createElement('div');
    const render = async () => {
      const source = chart.trim();
      if (!source) return;
      setLoading(true);
      setError('');
      initializeMermaid();
      container.setAttribute('aria-hidden', 'true');
      container.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
      document.body.appendChild(container);
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const escaped = escapeSequenceSemicolons(source);
      const useEscaped = escaped !== source && !(await mermaid.parse(source, { suppressErrors: true }));
      const { svg: renderedSvg } = await mermaid.render(id, useEscaped ? escaped : source, container);
      if (!cancelled) setSvg(renderedSvg);
    };
    render()
      .catch((err) => {
        console.error('Mermaid rendering error:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : t('chat.mermaid.renderError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        container.remove();
      });
    return () => {
      cancelled = true;
    };
  }, [chart, appearance, t]);

  if (loading) return <div className="mermaid-diagram mermaid-diagram--loading">{t('chat.mermaid.rendering')}</div>;

  if (error) {
    return (
      <div className="mermaid-diagram mermaid-diagram--error" title={error}>
        <div className="mermaid-error-message">
          <Icon name="error" size="sm" color="danger" />
          <span className="t-body-strong">{t('chat.mermaid.renderError')}</span>
          <span className="mermaid-error-reason t-caption">{error.split('\n')[0]}</span>
        </div>
        <details className="mermaid-error-source">
          <summary className="t-ui">
            <Icon name="chevronRight" size="sm" className="mermaid-error-chevron" />
            {t('chat.mermaid.showSource')}
          </summary>
          <pre className="t-code">{chart}</pre>
        </details>
      </div>
    );
  }

  if (!svg) return <div className="mermaid-diagram mermaid-diagram--empty">{t('chat.mermaid.empty')}</div>;

  const naturalWidth = Number(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(svg)?.[1]);
  return (
    <div
      className={cx('mermaid-diagram', scrollFadeClass('x', showScrollbar ? 'large' : 'default'), fullSize && 'mermaid-diagram--full-size', showScrollbar && 'mermaid-diagram--scrollbar')}
      style={naturalWidth > 0 ? { '--diagram-width': `${naturalWidth}px` } as CSSProperties : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default MermaidDiagram;
