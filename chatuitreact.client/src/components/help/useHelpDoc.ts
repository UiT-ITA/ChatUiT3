import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HelpSectionId } from './helpSections';

const FALLBACK_LANGUAGE = 'en-US';

/** Fetched documents, keyed `${lang}/${section}`. Lives for the page session. */
const cache = new Map<string, Promise<string>>();

/**
 * Loads `/docs/<lang>/<section>.md`. A missing file does not 404 here: both the
 * Vite dev server and the ASP.NET SPA fallback answer with index.html and 200,
 * so an HTML content type counts as missing. Missing localized files fall back
 * to English.
 */
async function fetchDoc(lang: string, section: HelpSectionId): Promise<string> {
  const response = await fetch(`/docs/${lang}/${section}.md`);
  const isHtml = response.headers.get('content-type')?.includes('text/html') ?? false;

  if (response.ok && !isHtml) {
    return response.text();
  }
  if (lang !== FALLBACK_LANGUAGE) {
    return fetchDoc(FALLBACK_LANGUAGE, section);
  }
  throw new Error(`Help document missing: ${section}`);
}

export type HelpDocState =
  | { status: 'loading' }
  | { status: 'ready'; markdown: string }
  | { status: 'error' };

export function useHelpDoc(section: HelpSectionId): HelpDocState {
  const { i18n } = useTranslation();
  const key = `${i18n.language}/${section}`;
  // The result is stored with the key it answers, so switching page or language
  // reads as "loading" until the matching fetch settles.
  const [settled, setSettled] = useState<{ key: string; state: HelpDocState } | null>(null);

  useEffect(() => {
    let cancelled = false;

    let pending = cache.get(key);
    if (!pending) {
      pending = fetchDoc(i18n.language, section);
      cache.set(key, pending);
      pending.catch(() => cache.delete(key));
    }

    pending.then(
      (markdown) => { if (!cancelled) setSettled({ key, state: { status: 'ready', markdown } }); },
      () => { if (!cancelled) setSettled({ key, state: { status: 'error' } }); },
    );

    return () => { cancelled = true; };
  }, [key, i18n.language, section]);

  return settled?.key === key ? settled.state : { status: 'loading' };
}
