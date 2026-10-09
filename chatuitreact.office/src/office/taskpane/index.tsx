/* global document, Office */

import { createRoot } from "react-dom/client";
import { App } from "../../chat/ui/App";
import { resolveHost } from "../hosts";

Office.onReady((info) => {
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
