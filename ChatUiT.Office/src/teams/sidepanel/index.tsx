/* global document */

import { app } from "@microsoft/teams-js";
import { createRoot } from "react-dom/client";
import { configureLoginHint } from "../../chat/auth/accountManager";
import { App } from "../../chat/ui/App";
import { teamsAdapter } from "../adapter";
import { paneTheme } from "../theme";

async function start() {
  const container = document.getElementById("root");
  if (!container) {
    return;
  }
  const root = createRoot(container);
  let context: app.Context;
  try {
    await app.initialize();
    context = await app.getContext();
  } catch {
    root.render(
      <App adapter={null} unsupportedMessage="Open ChatUiT from a Teams meeting." theme={paneTheme(undefined)} />
    );
    return;
  }
  configureLoginHint(async () => context.user?.loginHint || context.user?.userPrincipalName || undefined);
  const adapter = teamsAdapter(context);
  const render = (theme: string | undefined) =>
    root.render(<App adapter={adapter} unsupportedMessage="" theme={paneTheme(theme)} />);
  render(context.app.theme);
  app.registerOnThemeChangeHandler(render);
}

start();
