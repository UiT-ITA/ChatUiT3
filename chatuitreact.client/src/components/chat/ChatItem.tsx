import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from "../common/Icon";
import { Dialog, DialogButton } from "../common/Dialog";
import { getCurrentChatId, renameChat, setChatFavorite, deleteChat } from "../../services/chatService";
import { removeCachedChat } from "../../hooks/useChatCache";
import { useSignals } from "@preact/signals-react/runtime";
import type { ChatHeaderDto } from "../../types/chatModels";

interface ChatItemProps {
  chat: ChatHeaderDto;
  onNavigate?: () => void;
}

interface MenuState {
  x: number;
  y: number;
}

interface ContextMenuOption {
  key: string;
  label: string;
  icon: IconName;
  action: () => void;
}

export function ChatItem({ chat, onNavigate }: ChatItemProps) {
  useSignals();
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(chat.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const renameCommittedRef = useRef(false);
  const navigate = useNavigate();
  const currentChatId = getCurrentChatId();

  const startRename = () => {
    setDraftName(chat.name);
    renameCommittedRef.current = false;
    setIsRenaming(true);
  };

  const commitRename = () => {
    if (renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    setIsRenaming(false);

    const trimmed = draftName.trim();
    if (trimmed.length === 0 || trimmed === chat.name) return;

    renameChat(chat.id, trimmed).catch(() => {
      // apiService already raised a toast; keep the old name on screen.
    });
  };

  const cancelRename = () => {
    renameCommittedRef.current = true;
    setIsRenaming(false);
  };

  const toggleFavorite = () => {
    setChatFavorite(chat.id, !chat.isFavorite).catch(() => {
      // apiService already raised a toast.
    });
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteChat(chat.id);
      removeCachedChat(chat.id);
      setConfirmDelete(false);
      if (currentChatId.value === chat.id) {
        navigate('/');
      }
    } catch {
      // apiService already raised a toast; leave the dialog open.
    } finally {
      setIsDeleting(false);
    }
  };

  const contextMenuOptions: ContextMenuOption[] = [
    {
      key: 'favorite',
      label: chat.isFavorite ? t('sidebar.unfavorite') : t('sidebar.favorite'),
      icon: 'star',
      action: toggleFavorite,
    },
    { key: 'rename', label: t('sidebar.rename'), icon: 'edit', action: startRename },
    { key: 'delete', label: t('sidebar.delete'), icon: 'trash', action: () => setConfirmDelete(true) },
  ];

  useEffect(() => {
    if (!menu) return;

    const handleClick = () => setMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menu]);

  const handleMenuClick = (option: ContextMenuOption) => {
    setMenu(null);
    option.action();
  };

  const handleChatClick = () => {
    if (isRenaming) return;
    navigate(`/chat/${chat.id}`);
    onNavigate?.();
  };

  const handleMoreClick = (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
    e.stopPropagation();

    const chatItem = (e.target as HTMLElement).closest(".chat-item") as HTMLElement;
    if (!chatItem) return;

    const chatItemRect = chatItem.getBoundingClientRect();

    setMenu({
      x: chatItemRect.right + 8,
      y: chatItemRect.top,
    });
  };

  const isActiveChat = currentChatId.value === chat.id;

  return (
    <>
      <div
        className={`chat-item${isActiveChat ? " chat-item-active" : ""}`}
        title={isRenaming ? undefined : chat.name}
        onClick={handleChatClick}
      >
        {isRenaming ? (
          <input
            className="chat-item-rename-input t-ui"
            value={draftName}
            autoFocus
            onFocus={e => e.target.select()}
            onChange={e => setDraftName(e.target.value)}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
              }
            }}
          />
        ) : (
          <>
            <span className="chat-item-main t-ui">
              {chat.name}
            </span>
            {chat.isFavorite && (
              <span className="chat-item-star" title={t('sidebar.favorite')}>
                <Icon name="star" size={0.75} />
              </span>
            )}
            <span
              className="chat-item-more"
              onClick={handleMoreClick}
              title={t('sidebar.moreOptions')}
            >
              <Icon name="moreVert" size={1} />
            </span>
          </>
        )}
      </div>
      {menu &&
        createPortal(
          <ul
            className="chat-context-menu"
            // The document-level mousedown listener closes the menu. Without this
            // guard it would unmount the list between mousedown and mouseup, so the click
            // on a menu item would never be delivered.
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${menu.x}px`,
              top: `${menu.y}px`,
              zIndex: 1000,
            }}
          >
            {contextMenuOptions.map(option => (
              <li
                key={option.key}
                onClick={e => {
                  e.stopPropagation();
                  handleMenuClick(option);
                }}
                className="chat-context-menu-item t-ui-plain"
              >
                <span className="menu-icon"><Icon name={option.icon} size={1} /></span>
                <span>{option.label}</span>
              </li>
            ))}
          </ul>,
          document.body
        )}
      <Dialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('chat.deleteDialog.title')}
        size="small"
      >
        <p className="t-body">{t('chat.deleteDialog.confirm', { name: chat.name })}</p>
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
