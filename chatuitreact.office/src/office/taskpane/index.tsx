/* global document, Office */

import { createRoot } from "react-dom/client";
import { configureLoginHint } from "../../chat/auth/accountManager";
import { App } from "../../chat/ui/App";
import { resolveHost } from "../hosts";
import { getOfficeLoginHint } from "../shared/loginHint";

Office.onReady((info) => {
  configureLoginHint(getOfficeLoginHint);
  const container = document.getElementById("root");
  if (!container) {
    return;
  }
  const host = resolveHost(info.host);
  createRoot(container).render(
    "adapter" in host ? (
      <App adapter={host.adapter} unsupportedMessage="" />
    ) : (
      <App adapter={null} unsupportedMessage={host.message} />
    )
  );
});
