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

function groupChats(chats: ChatHeaderDto[], t: (key: string) => string): ChatGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const today: ChatHeaderDto[] = [];
  const yesterday: ChatHeaderDto[] = [];
  const earlier: ChatHeaderDto[] = [];

  for (const chat of chats) {
    const updated = new Date(chat.updatedAt).getTime();
    if (updated >= startOfToday) {
      today.push(chat);
    } else if (updated >= startOfYesterday) {
      yesterday.push(chat);
    } else {
      earlier.push(chat);
    }
  }

  return [
    { label: t('chat.groups.today'), chats: today },
    { label: t('chat.groups.yesterday'), chats: yesterday },
    { label: t('chat.groups.earlier'), chats: earlier },
  ].filter((group) => group.chats.length > 0);
}

export function ChatList({ filter, onNavigate }: ChatListProps) {
  useSignals();
  const { t } = useTranslation();
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

  const groups = groupChats(filtered, t);

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
