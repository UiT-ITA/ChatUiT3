import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../common/layout';
import Text from '../common/Text';
import { pxToRem } from '../../utils/units';
import { FilledContext } from './codeBlockFill';
import './HtmlPreview.css';

/** The one host the page may load scripts, styles, images and fonts from. */
const CDN = 'https://cdn.jsdelivr.net';

/** Blocks every request except inline code and the CDN, so the page cannot send data anywhere. */
const CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' 'unsafe-eval' ${CDN}`,
  `style-src 'unsafe-inline' ${CDN}`,
  `img-src data: blob: ${CDN}`,
  `font-src data: ${CDN}`,
  'media-src data: blob:',
].join('; ');

/** Message key the page uses to report its content height. */
const HEIGHT_KEY = 'chatuitHtmlHeight';

/**
 * Posts the page's content height to the app whenever the root, the body or a child of the body resizes, and whenever
 * the app asks for it. The height is the larger of the root's box and the body's scroll height, which also counts
 * content overflowing a body with a fixed height.
 */
const HEIGHT_SCRIPT = `(function () {
  function post() {
    var body = document.body;
    var height = Math.max(document.documentElement.getBoundingClientRect().height, body ? body.scrollHeight : 0);
    parent.postMessage({ ${HEIGHT_KEY}: Math.ceil(height) }, '*');
  }
  var observer = new ResizeObserver(post);
  observer.observe(document.documentElement);
  addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body);
    for (var i = 0; i < document.body.children.length; i++) observer.observe(document.body.children[i]);
  });
  addEventListener('message', function (event) {
    if (event.source === parent) post();
  });
})();`;

/** The model's HTML inside a document whose head sets the CSP, a light page and the height reporter, before any of its own content. */
function buildDocument(html: string): string {
  return '<!doctype html><html><head><meta charset="utf-8">'
    + `<meta http-equiv="Content-Security-Policy" content="${CSP}">`
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<style>:root { color-scheme: light; background: Canvas; color: CanvasText; }</style>'
    + `<script>${HEIGHT_SCRIPT}</script>`
    + `</head><body>${html}</body></html>`;
}

/**
 * HTML, CSS and JavaScript from the model, rendered in an iframe sandboxed to scripts only, with an opaque origin.
 * Inline it is as tall as its content; in full view it fills the block. When the page loads a second time, it has
 * navigated away from the model's HTML, and a notice replaces it.
 */
function HtmlPreview({ code }: { code: string }) {
  const { t } = useTranslation();
  const filled = useContext(FilledContext);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [navigatedAway, setNavigatedAway] = useState(false);
  const loadedDocRef = useRef<string | null>(null);
  const srcDoc = useMemo(() => buildDocument(code), [code]);

  const handleLoad = () => {
    if (loadedDocRef.current === srcDoc) {
      setNavigatedAway(true);
      return;
    }
    loadedDocRef.current = srcDoc;
    frameRef.current?.contentWindow?.postMessage(HEIGHT_KEY, '*');
  };

  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const value = (event.data as Record<string, unknown> | null)?.[HEIGHT_KEY];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) setHeight(value);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (navigatedAway) {
    return <Text as="div" variant="caption" tone="muted" p="md">{t('chat.html.navigatedAway')}</Text>;
  }

  return (
    <iframe
      ref={frameRef}
      className={cx('html-preview', filled && 'html-preview--filled')}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      title={t('chat.html.previewTitle')}
      style={!filled && height !== null ? { height: pxToRem(height) } : undefined}
    />
  );
}

export default HtmlPreview;
