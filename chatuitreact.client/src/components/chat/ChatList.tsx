import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useChatList } from "../../hooks/useChatData";
import { CachedChatItem } from "../../types/chatModels";
import { useNavigate, useParams } from "react-router-dom";
import { FaStar, FaEdit, FaTrash } from "react-icons/fa";
import { MdMoreVert } from "react-icons/md";
import "./ChatList.css";


const contextMenuOptions = [
  { label: "Favorite", icon: <FaStar />, action: (chat: CachedChatItem) => console.log(`Favorite clicked for ${chat.name}`) },
  { label: "Rename", icon: <FaEdit />, action: (chat: CachedChatItem) => console.log(`Rename clicked for ${chat.name}`) },
  { label: "Delete", icon: <FaTrash />, action: (chat: CachedChatItem) => console.log(`Delete clicked for ${chat.name}`) },
];

export const ChatList = React.memo(() => {
  const chatList = useChatList();
  const [menu, setMenu] = useState<{
    chat: CachedChatItem;
    x: number;
    y: number;
  } | null>(null);
  const [immediateActiveId, setImmediateActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { chatId: activeChatId } = useParams<{ chatId: string }>();

  useEffect(() => {
    if (activeChatId && immediateActiveId === activeChatId) {
      setImmediateActiveId(null);
    }
  }, [activeChatId, immediateActiveId]);

  useEffect(() => {
    if (!menu) return;
    const handleClick = () => {
      setMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menu]);

  const handleMenuClick = (option: typeof contextMenuOptions[0], chat: CachedChatItem) => {
    option.action(chat);
    setMenu(null);
  };

  const handleChatClick = (chat: CachedChatItem) => {
    setImmediateActiveId(chat.id);
    navigate(`/c/${chat.id}`);
  };

  const handleMoreClick = (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    chat: CachedChatItem
  ) => {
    e.stopPropagation();

    const chatItem = (e.target as HTMLElement).closest(".chat-item") as HTMLElement;
    if (!chatItem) return;

    const chatItemRect = chatItem.getBoundingClientRect();

    setMenu({
      chat,
      x: chatItemRect.right + 8,
      y: chatItemRect.top,
    });
  };

  const isActiveChat = (chatId: string) => {
    return activeChatId === chatId || immediateActiveId === chatId;
  };

  return (
    <div className="chat-list-container">
      {chatList.length === 0 ? (
        <div className="chat-list-empty">No chats yet</div>
      ) : (
        chatList.map((chat: CachedChatItem) => (
          <div
            key={chat.id}
            className={`chat-item${isActiveChat(chat.id) ? " chat-item-active" : ""}`}
            title={chat.name}
          >
            <span
              className="chat-item-main"
              onClick={() => handleChatClick(chat)}
            >
              {chat.name}
            </span>
            <span
              className="chat-item-more"
              onClick={e => handleMoreClick(e, chat)}
              title="More"
            >
              <MdMoreVert size={16} />
            </span>
          </div>
        ))
      )}
      {menu &&
        ReactDOM.createPortal(
          <ul
            className="chat-context-menu"
            style={{
              "--menu-x": `${menu.x}px`,
              "--menu-y": `${menu.y}px`,
            } as React.CSSProperties}
          >
            {contextMenuOptions.map(option => (
              <li
                key={option.label}
                onClick={e => {
                  e.stopPropagation();
                  handleMenuClick(option, menu.chat);
                }}
                className="chat-context-menu-item"
              >
                <span className="menu-icon">{option.icon}</span>
                <span>{option.label}</span>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
});
