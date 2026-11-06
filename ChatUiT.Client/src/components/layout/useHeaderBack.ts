import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getChat } from '../../services/chatService';
import { editorHeaderSignal, filledCodeBlockSignal } from '../../services/uiService';
import { parseRoute, sectionPath } from '../../utils/routes';

/**
 * The header's back control: to the conversation from a code block in full view, to the list of an open edit page,
 * or to the section root from a mobile detail view. Undefined when the header has none. Reads signals, so the
 * calling component calls useSignals.
 */
export function useHeaderBack(isMobile?: boolean): { label: string; onBack: () => void } | undefined {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section, newChat, view, chatId } = parseRoute(useLocation().pathname);
  const filled = filledCodeBlockSignal.value;
  if (filled && section === 'chats' && chatId) {
    return { label: getChat(chatId).value?.name || '…', onBack: () => { filledCodeBlockSignal.value = null; } };
  }
  const editor = editorHeaderSignal.value;
  if (editor) return { label: editor.backLabel, onBack: () => navigate(editor.backPath) };
  if (isMobile && view === 'detail' && !newChat) return { label: t(`contextColumn.${section}`), onBack: () => navigate(sectionPath(section)) };
  return undefined;
}
