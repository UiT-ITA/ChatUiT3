import { getChats } from "../../services/chatService";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from 'react-i18next';
import { ChatItem } from "./ChatItem";
import "./ChatList.css";

export function ChatList() {
  useSignals();
  const { t } = useTranslation();
  const chats = getChats();


  if (chats.value === undefined) {
    return <div className="chat-list-empty">{t('chat.loadingChats')}</div>;
  }

  if (chats.value.length === 0) {
    return <div className="chat-list-empty">{t('chat.noChatsFound')}</div>;
  }

  return (
    <div className="chat-list-container">
      {chats.value.map((chat) => (
        <ChatItem key={chat.id} chat={chat} />
      ))}
    </div>
  );
}
