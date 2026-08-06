import { getChats } from "../../services/chatService";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from 'react-i18next';
import type { ChatHeaderDto } from "../../types/chatModels";
import { ChatItem } from "./ChatItem";
import "./ChatList.css";

interface ChatListProps {
  filter?: string;
  onNavigate?: () => void;
}

interface ChatGroup {
  label: string;
  chats: ChatHeaderDto[];
}

interface Bucket {
  key: string;
  label: string;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  // Monday-based week: getDay() returns 0 for Sunday.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Buckets run from newest to oldest and are checked in that order, so each chat
// lands in the most specific bucket that still contains it.
function bucketFor(updated: Date, now: Date, locale: string, t: (key: string) => string): Bucket {
  const time = updated.getTime();
  const startToday = startOfDay(now).getTime();
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  const startThisWeek = startOfWeek(now).getTime();
  const startLastWeek = startOfWeek(new Date(startThisWeek - 24 * 60 * 60 * 1000)).getTime();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  if (time >= startToday) return { key: 'today', label: t('chat.groups.today') };
  if (time >= startYesterday) return { key: 'yesterday', label: t('chat.groups.yesterday') };
  if (time >= startThisWeek) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(updated);
    return { key: `weekday-${updated.getDay()}`, label: capitalize(weekday) };
  }
  if (time >= startLastWeek) return { key: 'lastWeek', label: t('chat.groups.lastWeek') };
  if (time >= startThisMonth) return { key: 'thisMonth', label: t('chat.groups.thisMonth') };
  if (time >= startLastMonth) return { key: 'lastMonth', label: t('chat.groups.lastMonth') };

  const month = capitalize(new Intl.DateTimeFormat(locale, { month: 'long' }).format(updated));
  const year = updated.getFullYear();
  return {
    key: `month-${year}-${updated.getMonth()}`,
    label: year === now.getFullYear() ? month : `${month} ${year}`,
  };
}

function groupChats(chats: ChatHeaderDto[], locale: string, t: (key: string) => string): ChatGroup[] {
  const now = new Date();

  const favorites: ChatHeaderDto[] = [];
  const rest: ChatHeaderDto[] = [];

  for (const chat of chats) {
    (chat.isFavorite ? favorites : rest).push(chat);
  }

  // Newest first, so buckets are created in the order they should be rendered.
  rest.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const groups: ChatGroup[] = [];
  const byKey = new Map<string, ChatGroup>();

  for (const chat of rest) {
    const bucket = bucketFor(new Date(chat.updatedAt), now, locale, t);
    let group = byKey.get(bucket.key);
    if (!group) {
      group = { label: bucket.label, chats: [] };
      byKey.set(bucket.key, group);
      groups.push(group);
    }
    group.chats.push(chat);
  }

  if (favorites.length > 0) {
    groups.unshift({ label: t('chat.groups.favorites'), chats: favorites });
  }

  return groups;
}

export function ChatList({ filter, onNavigate }: ChatListProps) {
  useSignals();
  const { t, i18n } = useTranslation();
  const chats = getChats();

  if (chats.value === undefined) {
    return <div className="chat-list-empty t-ui-plain">{t('chat.loadingChats')}</div>;
  }

  const query = (filter || '').trim().toLowerCase();
  const filtered = query
    ? chats.value.filter((chat) => chat.name.toLowerCase().includes(query))
    : chats.value;

  if (filtered.length === 0) {
    return (
      <div className="chat-list-empty t-ui-plain">
        {query ? t('chat.noChatsMatchSearch') : t('chat.noChatsFound')}
      </div>
    );
  }

  const groups = groupChats(filtered, i18n.language, t);

  return (
    <div className="chat-list-container">
      {groups.map((group) => (
        <div key={group.label} className="chat-list-group">
          <div className="context-group-label t-group-label">{group.label}</div>
          {group.chats.map((chat) => (
            <ChatItem key={chat.id} chat={chat} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );
}
