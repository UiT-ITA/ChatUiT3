/**
 * The help pages in reading order. Each id is a route segment (`/help/<id>`),
 * a translation key (`help.sections.<id>`) and a file name
 * (`public/docs/<lang>/<id>.md`), so the three stay in sync from here.
 */
export const HELP_SECTIONS = [
  'getting-started',
  'chatting',
  'files',
  'chats',
  'assistants',
  'models',
  'settings',
  'prompting',
  'troubleshooting',
] as const;

export type HelpSectionId = typeof HELP_SECTIONS[number];

export const DEFAULT_HELP_SECTION: HelpSectionId = HELP_SECTIONS[0];

export function isHelpSection(value: string | undefined): value is HelpSectionId {
  return HELP_SECTIONS.includes(value as HelpSectionId);
}
