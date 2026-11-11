/* global navigator */

import { Button, makeStyles } from "@fluentui/react-components";
import { useState, useSyncExternalStore } from "react";
import { getSignInPrompt, subscribeSignInPrompt, type SignInPrompt } from "../auth/browserSignIn";
import { color, font, radius, typography } from "./tokens";

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
    margin: "0 0.75rem 0.5rem",
    padding: "0.75rem",
    border: `1px solid ${color.line}`,
    borderRadius: radius.md,
    backgroundColor: color.panel,
  },
  title: { ...typography.ui, margin: 0, color: color.text },
  text: { ...typography.uiPlain, margin: 0, color: color.text2 },
  code: { ...typography.title, margin: 0, fontFamily: font.mono, letterSpacing: "0.08em", color: color.text },
  link: { ...typography.caption, margin: 0, overflowWrap: "anywhere", userSelect: "all", color: color.text2 },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" },
});

/** The browser sign-in prompt, while a sign-in waits for the user. */
export function SignInCard() {
  const prompt = useSyncExternalStore(subscribeSignInPrompt, getSignInPrompt);
  return prompt ? <PromptCard key={prompt.url} prompt={prompt} /> : null;
}

function PromptCard({ prompt }: { prompt: SignInPrompt }) {
  const styles = useStyles();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(prompt.url);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <div className={styles.card} role="region" aria-label="Sign in">
      <p className={styles.title}>Sign in to ChatUiT</p>
      <p className={styles.text}>
        ChatUiT can't show the sign-in page here. Open it in your browser, check that it shows this code, and select
        Continue there.
      </p>
      <p className={styles.code}>{prompt.matchCode}</p>
      {copy === "failed" && <p className={styles.link}>{prompt.url}</p>}
      <div className={styles.actions}>
        <Button as="a" appearance="primary" href={prompt.url} target="_blank" rel="noopener noreferrer">
          Open sign-in page
        </Button>
        <Button onClick={() => void copyLink()}>{copy === "copied" ? "Link copied" : "Copy link"}</Button>
        <Button appearance="subtle" onClick={prompt.cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
