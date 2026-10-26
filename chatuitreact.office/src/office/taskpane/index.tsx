/* global document, Office */

import { createRoot } from "react-dom/client";
import { configureLoginHint } from "../../chat/auth/accountManager";
import { App } from "../../chat/ui/App";
import type { PaneTheme } from "../../chat/ui/tokens";
import { resolveHost } from "../hosts";
import { getOfficeLoginHint } from "../shared/loginHint";
import { readOfficeTheme, watchOfficeTheme } from "../shared/theme";

Office.onReady((info) => {
  configureLoginHint(getOfficeLoginHint);
  const container = document.getElementById("root");
  if (!container) {
    return;
  }
  const host = resolveHost(info.host);
  const root = createRoot(container);
  let shown: PaneTheme | null = null;
  const render = (theme: PaneTheme) => {
    if (shown && shown.mode === theme.mode && shown.background === theme.background) {
      return;
    }
    shown = theme;
    root.render(
      "adapter" in host ? (
        <App adapter={host.adapter} unsupportedMessage="" theme={theme} />
      ) : (
        <App adapter={null} unsupportedMessage={host.message} theme={theme} />
      )
    );
  };
  render(readOfficeTheme());
  watchOfficeTheme(render);
});
