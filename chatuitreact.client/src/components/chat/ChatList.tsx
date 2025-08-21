import { getChats } from "../../services/chatService";
import { useSignals } from "@preact/signals-react/runtime";
import { ChatItem } from "./ChatItem";
import "./ChatList.css";

export function ChatList() {
  useSignals();
  const chats = getChats();


  if (chats.value === undefined) {
    return <div className="chat-list-empty">Loading chats...</div>;
  }

  if (chats.value.length === 0) {
    return <div className="chat-list-empty">No chats found.</div>;
  }

  return (
    <div className="chat-list-container">
      {chats.value.map((chat) => (
        <ChatItem key={chat.id} chat={chat} />
      ))}
    </div>
  );
}
