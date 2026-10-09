import { FluentProvider, makeStyles, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { useCallback } from "react";
import type { ResponsesClient } from "../api/client";
import { isBusy, type ToolFailure } from "../conversation/conversation";
import { useConversation } from "../conversation/useConversation";
import { logToolError } from "../dev/toolErrorLog";
import type { HostAdapter } from "../host";
import { Composer } from "./Composer";
import { DevHostBar } from "./DevHostBar";
import { useGlobalStyles } from "./globalStyles";
import { MessageList } from "./MessageList";
import { chatuitTheme } from "./theme";
import { useApiClient } from "./useApiClient";
import { color, font, typography } from "./tokens";

export interface AppProps {
  /** Null when the app is not supported. */
  adapter: HostAdapter | null;
  /** Shown instead of the chat when `adapter` is null. */
  unsupportedMessage: string;
}

const useStyles = makeStyles({
  // The app's base text, instead of Fluent's (14px, 20px line height).
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
  error: { margin: "0 0.875rem" },
});

export function App({ adapter, unsupportedMessage }: AppProps) {
  useGlobalStyles();
  const styles = useStyles();
  const { client, dev } = useApiClient();
  return (
    <FluentProvider theme={chatuitTheme} className={styles.root}>
      {dev && <DevHostBar host={dev.host} hosts={dev.hosts} onChange={dev.setHost} />}
      {adapter ? (
        <Chat adapter={adapter} client={client} devHost={dev?.host ?? null} />
      ) : (
        <p className={styles.unsupported}>{unsupportedMessage}</p>
      )}
    </FluentProvider>
  );
}

interface ChatProps {
  adapter: HostAdapter;
  client: ResponsesClient;
  /** Development builds only: the selected server. Failed tool calls are then logged to the dev server. */
  devHost: string | null;
}

function Chat({ adapter, client, devHost }: ChatProps) {
  const styles = useStyles();
  const logFailure = useCallback((failure: ToolFailure) => devHost && logToolError(failure, devHost), [devHost]);
  const { state, conversation } = useConversation(
    client,
    adapter.model,
    adapter.instructions,
    adapter.tools,
    devHost ? logFailure : undefined,
    adapter.getContext
  );
  const busy = isBusy(state);

  return (
    <div className={styles.chat}>
      <MessageList
        state={state}
        emptyMessage={adapter.emptyMessage}
        onAnswer={(requestId, decision) => conversation.answerApproval(requestId, decision)}
      />
      {state.error && (
        <MessageBar intent="error" className={styles.error}>
          <MessageBarBody>{state.error}</MessageBarBody>
        </MessageBar>
      )}
      <Composer
        Settings={adapter.Settings}
        busy={busy}
        onNewChat={() => conversation.reset()}
        onSend={(text, files) => void conversation.send(text, files)}
        onStop={() => conversation.cancel()}
      />
    </div>
  );
}
