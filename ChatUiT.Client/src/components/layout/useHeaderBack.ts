import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { editorHeaderSignal } from '../../services/uiService';
import { parseRoute, sectionPath } from '../../utils/routes';

/**
 * The header's back control: to the list of an open edit page, or to the section root from a mobile detail view.
 * Undefined when the header has none. Reads a signal, so the calling component calls useSignals.
 */
export function useHeaderBack(isMobile?: boolean): { path: string; label: string } | undefined {
  const { t } = useTranslation();
  const { section, newChat, view } = parseRoute(useLocation().pathname);
  const editor = editorHeaderSignal.value;
  if (editor) return { path: editor.backPath, label: editor.backLabel };
  if (isMobile && view === 'detail' && !newChat) return { path: sectionPath(section), label: t(`contextColumn.${section}`) };
  return undefined;
}
