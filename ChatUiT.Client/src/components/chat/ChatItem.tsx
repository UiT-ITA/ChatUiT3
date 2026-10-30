import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from "../common/Icon";
import { Dialog, DialogButton } from "../common/Dialog";
import IconButton from "../common/IconButton";
import { Menu, MenuItem } from "../common/Menu";
import TextInput from "../common/TextInput";
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
  key: 'favorite' | 'rename' | 'delete';
  label: string;
  icon: IconName;
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
    },
    { key: 'rename', label: t('sidebar.rename'), icon: 'edit' },
    { key: 'delete', label: t('sidebar.delete'), icon: 'trash' },
  ];

  const handleMenuClick = (option: ContextMenuOption) => {
    setMenu(null);
    switch (option.key) {
      case 'favorite':
        toggleFavorite();
        break;
      case 'rename':
        startRename();
        break;
      case 'delete':
        setConfirmDelete(true);
        break;
    }
  };

  const handleChatClick = () => {
    if (isRenaming) return;
    navigate(`/chat/${chat.id}`);
    onNavigate?.();
  };

  const handleMoreClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
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
          <TextInput
            size="small"
            grow
            shrink
            minWidth="0"
            value={draftName}
            autoFocus
            onFocus={e => e.target.select()}
            onChange={value => setDraftName(value)}
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
            {chat.redEnabled && (
              <span className="chat-item-lock" title={t('chat.redToggle.enabled')}>
                <Icon name="lock" size="xs" color="danger" />
              </span>
            )}
            {chat.isFavorite && (
              <span className="chat-item-star" title={t('sidebar.favorite')}>
                <Icon name="star" size="xs" color="accent" />
              </span>
            )}
            <span className="chat-item-more">
              <IconButton
                icon="moreVert"
                label={t('sidebar.moreOptions')}
                size="small"
                onClick={handleMoreClick}
              />
            </span>
          </>
        )}
      </div>
      {menu && (
        <Menu floating anchorPoint={menu} onClose={() => setMenu(null)}>
          {contextMenuOptions.map(option => (
            <MenuItem
              key={option.key}
              icon={option.icon}
              onClick={e => {
                e.stopPropagation();
                handleMenuClick(option);
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Menu>
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
