import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { Icon } from "../common/Icon";
import { getCurrentChatId } from "../../services/chatService";
import { useSignals } from "@preact/signals-react/runtime";
import type { ChatHeaderDto } from "../../types/chatModels";

interface ChatItemProps {
  chat: ChatHeaderDto;
}

interface MenuState {
  chat: ChatHeaderDto;
  x: number;
  y: number;
}

export function ChatItem({ chat }: ChatItemProps) {
  useSignals();
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const navigate = useNavigate();
  const currentChatId = getCurrentChatId();

  const contextMenuOptions = [
    { label: t('sidebar.favorite'), icon: <Icon name="star" size={1} />, action: (chat: ChatHeaderDto) => console.log(`Favorite clicked for ${chat.name}`) },
    { label: t('sidebar.rename'), icon: <Icon name="edit" size={1} />, action: (chat: ChatHeaderDto) => console.log(`Rename clicked for ${chat.name}`) },
    { label: t('sidebar.delete'), icon: <Icon name="trash" size={1} />, action: (chat: ChatHeaderDto) => console.log(`Delete clicked for ${chat.name}`) },
  ];

  useEffect(() => {
    if (!menu) return;
    const handleClick = () => {
      setMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menu]);

  const handleMenuClick = (option: typeof contextMenuOptions[0], chat: ChatHeaderDto) => {
    option.action(chat);
    setMenu(null);
  };

  const handleChatClick = (chat: ChatHeaderDto) => {
    navigate(`/chat/${chat.id}`);
  };

  const handleMoreClick = (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    chat: ChatHeaderDto
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
    return currentChatId.value === chatId;
  };

  return (
    <>
      <div
        className={`chat-item${isActiveChat(chat.id) ? " chat-item-active" : ""}`}
        title={chat.name}
        onClick={() => handleChatClick(chat)}
      >
        <span className="chat-item-main">
          {chat.name}
        </span>
        <span
          className="chat-item-more"
          onClick={e => handleMoreClick(e, chat)}
          title={t('sidebar.moreOptions')}
        >
          <Icon name="moreVert" size={1} />
        </span>
      </div>
      {menu &&
        createPortal(
          <ul
            className="chat-context-menu"
            style={{
              position: 'fixed',
              left: `${menu.x}px`,
              top: `${menu.y}px`,
              zIndex: 1000,
            }}
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
    </>
  );
}
