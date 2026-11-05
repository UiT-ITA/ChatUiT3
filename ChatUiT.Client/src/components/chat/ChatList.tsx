import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from 'react-i18next';
import { getChats, getCurrentChatId, renameChat, setChatFavorite, deleteChat } from "../../services/chatService";
import { removeCachedChat } from "../../hooks/useChatCache";
import type { ChatHeaderDto } from "../../types/chatModels";
import { Icon } from "../common/Icon";
import NavItem from "../common/NavItem";
import { SideColumnGroupLabel } from "../layout/AppShell";
import { Dialog, DialogButton } from "../common/Dialog";
import IconButton from "../common/IconButton";
import { Menu, MenuItem } from "../common/Menu";
import Box from "../common/Box";
import Stack from "../common/Stack";
import Text from "../common/Text";
import TextInput from "../common/TextInput";

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Monday-based week: getDay() returns 0 for Sunday
function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// The bucket of a date: the first of today, yesterday, a weekday this week, last week, this month, last month and the month of the date that contains it
function bucketFor(updated: Date, now: Date, locale: string, t: (key: string) => string): { key: string; label: string } {
  const time = updated.getTime();
  const startToday = startOfDay(now).getTime();
  const startThisWeek = startOfWeek(now).getTime();

  if (time >= startToday) return { key: 'today', label: t('chat.groups.today') };
  if (time >= startToday - DAY_MS) return { key: 'yesterday', label: t('chat.groups.yesterday') };
  if (time >= startThisWeek) {
    return { key: `weekday-${updated.getDay()}`, label: capitalize(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(updated)) };
  }
  if (time >= startOfWeek(new Date(startThisWeek - DAY_MS)).getTime()) return { key: 'lastWeek', label: t('chat.groups.lastWeek') };
  if (time >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()) return { key: 'thisMonth', label: t('chat.groups.thisMonth') };
  if (time >= new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()) return { key: 'lastMonth', label: t('chat.groups.lastMonth') };

  const month = capitalize(new Intl.DateTimeFormat(locale, { month: 'long' }).format(updated));
  const year = updated.getFullYear();
  return { key: `month-${year}-${updated.getMonth()}`, label: year === now.getFullYear() ? month : `${month} ${year}` };
}

/** The favourites first, then the other chats newest first in date buckets. */
function groupChats(chats: ChatHeaderDto[], locale: string, t: (key: string) => string) {
  const now = new Date();
  const favorites = chats.filter(chat => chat.isFavorite);
  const byKey = new Map<string, { label: string; chats: ChatHeaderDto[] }>();
  const rest = chats
    .filter(chat => !chat.isFavorite)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  for (const chat of rest) {
    const bucket = bucketFor(new Date(chat.updatedAt), now, locale, t);
    if (!byKey.has(bucket.key)) byKey.set(bucket.key, { label: bucket.label, chats: [] });
    byKey.get(bucket.key)!.chats.push(chat);
  }

  return [...(favorites.length > 0 ? [{ label: t('chat.groups.favorites'), chats: favorites }] : []), ...byKey.values()];
}

export function ChatList({ filter }: { filter?: string }) {
  useSignals();
  const { t, i18n } = useTranslation();
  const chats = getChats();

  if (chats.value === undefined) {
    return <Text as="div" variant="ui-plain" tone="muted" py="lg" px="md">{t('chat.loadingChats')}</Text>;
  }

  const query = (filter || '').trim().toLowerCase();
  const filtered = chats.value.filter((chat) => chat.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    return (
      <Text as="div" variant="ui-plain" tone="muted" py="lg" px="md">
        {query ? t('chat.noChatsMatchSearch') : t('chat.noChatsFound')}
      </Text>
    );
  }

  return (
    <Stack gap="none" width="full">
      {groupChats(filtered, i18n.language, t).map((group) => (
        <Box key={group.label} mb="md">
          <SideColumnGroupLabel>{group.label}</SideColumnGroupLabel>
          {group.chats.map((chat) => (
            <ChatItem key={chat.id} chat={chat} />
          ))}
        </Box>
      ))}
    </Stack>
  );
}

/** A chat in the list, with its menu for favourite, rename and delete. */
function ChatItem({ chat }: { chat: ChatHeaderDto }) {
  useSignals();
  const { t } = useTranslation();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(chat.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const renameCommittedRef = useRef(false);
  const navigate = useNavigate();
  const currentChatId = getCurrentChatId();

  // Ends renaming once, and saves a changed name. A failed rename keeps the old name and apiService shows the error.
  const endRename = (save: boolean) => {
    if (renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (save && trimmed.length > 0 && trimmed !== chat.name) renameChat(chat.id, trimmed).catch(() => {});
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteChat(chat.id);
      removeCachedChat(chat.id);
      setConfirmDelete(false);
      if (currentChatId.value === chat.id) navigate('/');
    } catch {
      // Keeps the dialog open. apiService shows the error.
    } finally {
      setIsDeleting(false);
    }
  };

  // Opens the menu under the more button
  const handleMoreClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ x: rect.left, y: rect.bottom });
  };

  const pick = (e: React.MouseEvent, run: () => void) => {
    e.stopPropagation();
    setMenu(null);
    run();
  };

  return (
    <>
      <NavItem
        labelWeight="regular"
        active={currentChatId.value === chat.id}
        title={chat.name}
        onClick={() => {
          if (!isRenaming) navigate(`/chat/${chat.id}`);
        }}
        trailing={(chat.redEnabled || chat.isFavorite) && (
          <>
            {chat.redEnabled && <Icon name="lock" size="sm" color="danger" label={t('chat.redToggle.enabled')} />}
            {chat.isFavorite && <Icon name="star" size="sm" color="accent" label={t('sidebar.favorite')} />}
          </>
        )}
        actions={!isRenaming && (
          <IconButton icon="moreVert" label={t('sidebar.moreOptions')} size="small" onClick={handleMoreClick} />
        )}
        editor={isRenaming ? (
          <TextInput
            size="small"
            grow
            shrink
            minWidth="0"
            value={draftName}
            autoFocus
            onFocus={e => e.target.select()}
            onChange={value => setDraftName(value)}
            onBlur={() => endRename(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                endRename(e.key === 'Enter');
              }
            }}
          />
        ) : undefined}
      >
        {chat.name}
      </NavItem>
      {menu && (
        <Menu floating anchorPoint={menu} onClose={() => setMenu(null)}>
          <MenuItem icon="star" onClick={e => pick(e, () => setChatFavorite(chat.id, !chat.isFavorite).catch(() => {}))}>
            {chat.isFavorite ? t('sidebar.unfavorite') : t('sidebar.favorite')}
          </MenuItem>
          <MenuItem icon="edit" onClick={e => pick(e, () => {
            setDraftName(chat.name);
            renameCommittedRef.current = false;
            setIsRenaming(true);
          })}>
            {t('sidebar.rename')}
          </MenuItem>
          <MenuItem icon="trash" onClick={e => pick(e, () => setConfirmDelete(true))}>{t('sidebar.delete')}</MenuItem>
        </Menu>
      )}
      <Dialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('chat.deleteDialog.title')}
        size="small"
      >
        <Text as="p" variant="body">{t('chat.deleteDialog.confirm', { name: chat.name })}</Text>
        <DialogButton variant="secondary" onClick={() => setConfirmDelete(false)}>
          {t('common.cancel')}
        </DialogButton>
        <DialogButton variant="danger" onClick={handleConfirmDelete} loading={isDeleting}>
          {t('common.delete')}
        </DialogButton>
      </Dialog>
    </>
  );
}
