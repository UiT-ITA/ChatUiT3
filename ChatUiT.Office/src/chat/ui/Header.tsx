/* global console */

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
import { color, space, icon, size, typography } from "./tokens";

export interface HeaderProps {
  logoUrl: string;
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
  // Office draws its personality menu over the top-right corner of the task pane (Mac), so the
  // buttons end left of it.
  root: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: space.xs,
    height: `calc(${space["2xl"]} + ${space.sm})`,
    padding: `0 calc(${space["2xl"]} + ${space.sm}) 0 ${space.md}`,
  },
  logo: { display: "block", width: icon.md, height: icon.md },
  spacer: { flex: 1 },
  history: { width: size.sm, maxWidth: `calc(100vw - ${space.xl})`, maxHeight: size.sm, overflowY: "auto" },
  chatTitle: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chatDate: { flexShrink: 0, whiteSpace: "nowrap" },
  note: { ...typography.caption, padding: `${space.sm} ${space.sm}`, color: color.text3 },
});

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

/** The pane's top bar: the ChatUiT logo, the saved chats of this document, New chat and the menu. */
export function Header({
  logoUrl,
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
  const [chats, setChats] = useState<ChatList | "failed" | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    void getUserName?.().then(setUserName);
  }, [getUserName]);

  const openHistory = (open: boolean) => {
    setHistoryOpen(open);
    if (open) {
      setChats(undefined);
      listChats().then(setChats, (error: unknown) => {
        console.warn("The saved chats could not be read.", error);
        setChats("failed");
      });
    }
  };

  return (
    <header className={styles.root}>
      <img className={styles.logo} src={logoUrl} alt="ChatUiT" />
      <span className={styles.spacer} />

      <Menu open={historyOpen} onOpenChange={(_event, data) => openHistory(data.open)} positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          <ToolbarButton icon="history" label="Chat history" active={historyOpen} />
        </MenuTrigger>
        <MenuPopover>
          <MenuList className={styles.history}>
            {chats === undefined ? (
              <div className={styles.note}>Loading…</div>
            ) : chats === "failed" ? (
              <div className={styles.note}>The saved chats could not be read.</div>
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

      {(MenuItems || userName || dev) && (
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
      )}
    </header>
  );
}
