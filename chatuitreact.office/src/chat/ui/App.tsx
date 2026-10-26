/* global document */

import { FluentProvider, makeStyles, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { ResponsesClient } from "../api/client";
import { isBusy, type ToolFailure } from "../conversation/conversation";
import { useConversation } from "../conversation/useConversation";
import { logToolError } from "../dev/toolErrorLog";
import { useChatHistory } from "../history/useChatHistory";
import type { HostAdapter } from "../host";
import { Composer } from "./Composer";
import { useGlobalStyles } from "./globalStyles";
import { Header, type HeaderProps } from "./Header";
import { MessageList } from "./MessageList";
import { chatuitTheme } from "./theme";
import { useApiClient } from "./useApiClient";
import { color, font, paletteVariables, typography, type PaneTheme } from "./tokens";

export interface AppProps {
  /** Null when the app is not supported. */
  adapter: HostAdapter | null;
  /** Shown instead of the chat when `adapter` is null. */
  unsupportedMessage: string;
  theme: PaneTheme;
}

const useStyles = makeStyles({
  // The pane's layout, background and base text (instead of Fluent's 14px, 20px line height), inside the
  // provider. The provider gets no class: Fluent also gives its class to the containers of menus.
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: font.sans,
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 1.5,
    backgroundColor: color.bg,
    color: color.text,
  },
  chat: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 },
  unsupported: { ...typography.chat, margin: 0, padding: "2rem 0.875rem", textAlign: "center", color: color.text2 },
  error: { margin: "0 0.75rem 0.5rem" },
});

export function App({ adapter, unsupportedMessage, theme }: AppProps) {
  useGlobalStyles();
  const styles = useStyles();
  const { client, dev } = useApiClient();
  const fluentTheme = useMemo(() => chatuitTheme(theme.mode), [theme.mode]);

  // The colours are CSS variables on the page, so the global styles and Fluent's portals follow the theme too.
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(paletteVariables(theme))) {
      root.style.setProperty(name, value);
    }
    root.style.colorScheme = theme.mode;
  }, [theme]);

  return (
    <FluentProvider theme={fluentTheme}>
      <div className={styles.root}>
        {adapter ? (
          <Chat adapter={adapter} client={client} dev={dev} />
        ) : (
          <p className={styles.unsupported}>{unsupportedMessage}</p>
        )}
      </div>
    </FluentProvider>
  );
}

interface ChatProps {
  adapter: HostAdapter;
  client: ResponsesClient;
  /** Development builds only: the selected server. Failed tool calls are then logged to the dev server. */
  dev: HeaderProps["dev"];
}

function Chat({ adapter, client, dev }: ChatProps) {
  const styles = useStyles();
  const devHost = dev?.host ?? null;
  const logFailure = useCallback((failure: ToolFailure) => devHost && logToolError(failure, devHost), [devHost]);
  const { state, conversation } = useConversation(
    client,
    adapter.model,
    adapter.instructions,
    adapter.tools,
    devHost ? logFailure : undefined,
    adapter.getContext
  );
  const history = useChatHistory(state, conversation, adapter.getDocumentKey);
  const [draft, setDraft] = useState<{ text: string; id: number } | null>(null);
  const busy = isBusy(state);

  return (
    <div className={styles.chat}>
      <Header
        onOpenChat={(id) => void history.open(id)}
        listChats={history.list}
        noDocumentMessage={adapter.noDocumentMessage}
        onNewChat={history.startNew}
        getUserName={adapter.getUserName}
        MenuItems={adapter.MenuItems}
        dev={dev}
      />
      <MessageList
        state={state}
        emptyMessage={adapter.emptyMessage}
        starters={adapter.starters}
        onStarter={(starter) => setDraft((current) => ({ text: starter.prompt, id: (current?.id ?? 0) + 1 }))}
        onAnswer={(requestId, decision) => conversation.answerApproval(requestId, decision)}
      />
      {state.error && (
        <MessageBar intent="error" className={styles.error}>
          <MessageBarBody>{state.error}</MessageBarBody>
        </MessageBar>
      )}
      <Composer
        draft={draft}
        busy={busy}
        onSend={(text, files) => void conversation.send(text, files)}
        onStop={() => conversation.cancel()}
      />
    </div>
  );
}
