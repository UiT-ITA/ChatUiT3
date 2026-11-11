/* global document, fetch, URLSearchParams, window */

import { Button, FluentProvider, makeStyles } from "@fluentui/react-components";
import { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { matchCode, parseState, relayUrl, type SignInRelayResult } from "../../chat/auth/signInRelay";
import { useGlobalStyles } from "../../chat/ui/globalStyles";
import { chatuitTheme } from "../../chat/ui/theme";
import { color, font, paletteVariables, typography, type ThemeMode } from "../../chat/ui/tokens";

/**
 * The page Entra returns to after a browser sign-in started from the task pane. It reads the authorization
 * code from the URL fragment and, after the user confirms the code the pane shows, posts it to the relay.
 * Entra's errors are posted without confirmation.
 */

type Step =
  | { kind: "unknown" }
  | { kind: "confirm"; matchCode: string }
  | { kind: "sending" }
  | { kind: "done" }
  | { kind: "failed"; message: string };

type SignInResponse = { id: string; relay: string; result: SignInRelayResult } | null;

const useStyles = makeStyles({
  root: {
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "3rem 1rem",
    boxSizing: "border-box",
    fontFamily: font.sans,
    backgroundColor: color.bg,
    color: color.text,
  },
  card: { display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "26rem" },
  title: { ...typography.title, margin: 0 },
  text: { ...typography.chat, margin: 0, color: color.text2 },
  code: { ...typography.title, margin: 0, fontFamily: font.mono, letterSpacing: "0.08em" },
  actions: { display: "flex", gap: "0.5rem" },
});

/** Reads the sign-in response from the URL fragment and removes it from the address bar. */
function readResponse(): SignInResponse {
  const params = new URLSearchParams(window.location.hash.slice(1));
  window.history.replaceState(null, "", window.location.pathname);
  const parsed = parseState(params.get("state") ?? "");
  if (!parsed) {
    return null;
  }
  const relay = relayUrl(parsed.origin, parsed.id, window.location.href);
  const code = params.get("code");
  if (code) {
    return { id: parsed.id, relay, result: { code } };
  }
  const error = params.get("error");
  return error ? { id: parsed.id, relay, result: { error: params.get("error_description") || error } } : null;
}

async function post(relay: string, result: SignInRelayResult): Promise<void> {
  const response = await fetch(relay, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });
  if (!response.ok) {
    throw new Error(`The ChatUiT server answered ${response.status}`);
  }
}

function SignInPage({ response, mode }: { response: SignInResponse; mode: ThemeMode }) {
  useGlobalStyles();
  const styles = useStyles();
  const [step, setStep] = useState<Step>(() => (response ? { kind: "sending" } : { kind: "unknown" }));

  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(paletteVariables({ mode, background: null }))) {
      root.style.setProperty(name, value);
    }
    root.style.colorScheme = mode;
  }, [mode]);

  useLayoutEffect(() => {
    if (!response) {
      return;
    }
    const { relay, result } = response;
    if (result.error) {
      post(relay, result).then(
        () => setStep({ kind: "failed", message: result.error }),
        () => setStep({ kind: "failed", message: result.error })
      );
      return;
    }
    void matchCode(response.id).then((code) => setStep({ kind: "confirm", matchCode: code }));
  }, [response]);

  const send = async () => {
    if (!response) {
      return;
    }
    setStep({ kind: "sending" });
    try {
      await post(response.relay, response.result);
      setStep({ kind: "done" });
    } catch (error) {
      setStep({ kind: "failed", message: String(error) });
    }
  };

  return (
    <FluentProvider theme={chatuitTheme(mode)}>
      <main className={styles.root}>
        <div className={styles.card}>
          <h1 className={styles.title}>Sign in to ChatUiT</h1>
          {step.kind === "unknown" && (
            <p className={styles.text}>
              This page finishes a sign-in started from ChatUiT in Office. There is nothing to do here.
            </p>
          )}
          {step.kind === "confirm" && (
            <>
              <p className={styles.text}>
                Continue only if you started signing in to ChatUiT yourself and ChatUiT shows this code:
              </p>
              <p className={styles.code}>{step.matchCode}</p>
              <div className={styles.actions}>
                <Button appearance="primary" onClick={() => void send()}>
                  Continue
                </Button>
              </div>
            </>
          )}
          {step.kind === "sending" && <p className={styles.text}>Signing in...</p>}
          {step.kind === "done" && (
            <p className={styles.text}>You're signed in. Go back to ChatUiT. You can close this page.</p>
          )}
          {step.kind === "failed" && <p className={styles.text}>The sign-in failed: {step.message}</p>}
        </div>
      </main>
    </FluentProvider>
  );
}

const container = document.getElementById("root");
if (container) {
  const mode: ThemeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  createRoot(container).render(<SignInPage response={readResponse()} mode={mode} />);
}
