import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useChats } from "../../hooks/useChats";
import { Chat } from "../../types/chatModels";
import { useNavigate, useParams } from "react-router-dom";
import { FaStar, FaEdit, FaTrash } from "react-icons/fa";
import { MdMoreVert } from "react-icons/md";
import "./ChatList.css";
import { useTranslation } from "react-i18next";



export const ChatList = React.memo(() => {
  const { t } = useTranslation();
  const { isAuthenticated, isInitializing } = useAuth();
  const { data: chatList = [] } = useChats(!isInitializing && isAuthenticated);
  const [menu, setMenu] = useState<{
    chat: Chat;
    x: number;
    y: number;
  } | null>(null);
  const [immediateActiveId, setImmediateActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { chatId: activeChatId } = useParams<{ chatId: string }>();

  const contextMenuOptions = [
    { label: t('sidebar.favorite'), icon: <FaStar />, action: (chat: Chat) => console.log(`Favorite clicked for ${chat.name}`) },
    { label: t('sidebar.rename'), icon: <FaEdit />, action: (chat: Chat) => console.log(`Rename clicked for ${chat.name}`) },
    { label: t('sidebar.delete'), icon: <FaTrash />, action: (chat: Chat) => console.log(`Delete clicked for ${chat.name}`) },
  ];
  
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

  const handleMenuClick = (option: typeof contextMenuOptions[0], chat: Chat) => {
    option.action(chat);
    setMenu(null);
  };

  const handleChatClick = (chat: Chat) => {
    setImmediateActiveId(chat.id);
    navigate(`/c/${chat.id}`);
  };

  const handleMoreClick = (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    chat: Chat
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
        <div className="chat-list-empty">{t('sidebar.noChats')}</div>
      ) : (
        chatList.map((chat: Chat) => (
          <div
            key={chat.id}
            className={`chat-item${isActiveChat(chat.id) ? " chat-item-active" : ""}`}
            title={chat.name}
            onClick={() => handleChatClick(chat)}
          >
            <span
              className="chat-item-main"
            >
              {chat.name}
            </span>
            <span
              className="chat-item-more"
              onClick={e => handleMoreClick(e, chat)}
              title={t('sidebar.moreOptions')}
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
