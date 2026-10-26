import {
  makeStyles,
  Menu,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from "@fluentui/react-components";
import { useEffect, useState, type ComponentType } from "react";
import type { ChatList } from "../history/useChatHistory";
import { ToolbarButton } from "./ToolbarButton";
import { color, typography } from "./tokens";

export interface HeaderProps {
  /** Opens a saved chat. */
  onOpenChat(id: string): void;
  listChats(): Promise<ChatList>;
  /** Shown in the history menu when the document has no key yet. */
  noDocumentMessage: string;
  onNewChat(): void;
  getUserName?: () => Promise<string | undefined>;
  /** App-specific items in the menu. */
  MenuItems?: ComponentType;
  /** Development builds only: the selected server and the servers to choose from. */
  dev: { host: string; hosts: readonly string[]; setHost(host: string): void } | null;
}

const useStyles = makeStyles({
  // Office draws its personality menu over the top-right 34x32 px of the task pane (Mac), so the
  // buttons end left of it.
  root: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "0.125rem",
    height: "2.5rem",
    padding: "0 2.5rem 0 0.75rem",
  },
  logo: { display: "block", width: "1.25rem", height: "1.25rem" },
  spacer: { flex: 1 },
  history: { width: "18rem", maxWidth: "calc(100vw - 1.5rem)", maxHeight: "20rem", overflowY: "auto" },
  chatTitle: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chatDate: { flexShrink: 0, whiteSpace: "nowrap" },
  note: { ...typography.caption, padding: "0.375rem 0.5rem", color: color.text3 },
});

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

/** The pane's top bar: the ChatUiT logo, the saved chats of this document, New chat and the menu. */
export function Header({
  onOpenChat,
  listChats,
  noDocumentMessage,
  onNewChat,
  getUserName,
  MenuItems,
  dev,
}: HeaderProps) {
  const styles = useStyles();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chats, setChats] = useState<ChatList | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    void getUserName?.().then(setUserName);
  }, [getUserName]);

  const openHistory = (open: boolean) => {
    setHistoryOpen(open);
    if (open) {
      setChats(undefined);
      listChats().then(setChats, () => setChats([]));
    }
  };

  return (
    <header className={styles.root}>
      <img className={styles.logo} src="assets/icon-64.png" alt="ChatUiT" />
      <span className={styles.spacer} />

      <Menu open={historyOpen} onOpenChange={(_event, data) => openHistory(data.open)} positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          <ToolbarButton icon="history" label="Chat history" active={historyOpen} />
        </MenuTrigger>
        <MenuPopover>
          <MenuList className={styles.history}>
            {chats === undefined ? (
              <div className={styles.note}>Loading…</div>
            ) : chats === null ? (
              <div className={styles.note}>{noDocumentMessage}</div>
            ) : chats.length === 0 ? (
              <div className={styles.note}>No saved chats yet.</div>
            ) : (
              chats.map((chat) => (
                <MenuItem
                  key={chat.id}
                  onClick={() => onOpenChat(chat.id)}
                  content={{ className: styles.chatTitle, children: chat.title || "Untitled chat" }}
                  secondaryContent={{ className: styles.chatDate, children: dateFormat.format(chat.updatedAt) }}
                />
              ))
            )}
          </MenuList>
        </MenuPopover>
      </Menu>

      <ToolbarButton icon="chatNew" label="New chat" onClick={onNewChat} />

      <Menu
        open={menuOpen}
        onOpenChange={(_event, data) => setMenuOpen(data.open)}
        positioning="below-end"
        checkedValues={dev ? { server: [dev.host] } : undefined}
        onCheckedValueChange={(_event, data) => data.name === "server" && dev?.setHost(data.checkedItems[0])}
      >
        <MenuTrigger disableButtonEnhancement>
          <ToolbarButton icon="more" label="More" active={menuOpen} />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {MenuItems && <MenuItems />}
            {MenuItems && (userName || dev) && <MenuDivider />}
            {userName && <div className={styles.note}>Signed in as {userName}</div>}
            {dev && (
              <MenuGroup>
                <MenuGroupHeader>Server</MenuGroupHeader>
                {dev.hosts.map((host) => (
                  <MenuItemRadio key={host} name="server" value={host}>
                    {host}
                  </MenuItemRadio>
                ))}
              </MenuGroup>
            )}
          </MenuList>
        </MenuPopover>
      </Menu>
    </header>
  );
}
