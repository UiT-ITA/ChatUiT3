const SECTIONS = ['chats', 'assistants', 'generate', 'admin', 'settings', 'help', 'status'] as const;

export type Section = (typeof SECTIONS)[number];

export const NEW_CHAT_PATH = '/chat/new';

/** The root path of a section, which shows its list. */
export const sectionPath = (section: Section): string => (section === 'chats' ? '/chat' : `/${section}`);

/**
 * The section, open chat and view of a path. Paths outside every section belong to the chats.
 * "/" and "/chat/new" are a new chat. A section root is the list view, "/" and every deeper path the detail view.
 */
export function parseRoute(pathname: string) {
  const [first, ...params] = pathname.split('/').filter(Boolean);
  const section: Section = SECTIONS.find(key => sectionPath(key) === `/${first}`) ?? 'chats';
  const view: 'list' | 'detail' = first === undefined || params.length > 0 ? 'detail' : 'list';
  return {
    section,
    params,
    chatId: first === 'chat' && params[0] !== 'new' ? params[0] : undefined,
    newChat: first === undefined || (first === 'chat' && params[0] === 'new'),
    view,
  };
}
