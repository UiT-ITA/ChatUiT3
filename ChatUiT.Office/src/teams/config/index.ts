/* global URL, window */

import { app, pages } from "@microsoft/teams-js";

/** The configuration page Teams shows when the app is added to a meeting. Saving adds the side panel. */
async function start() {
  await app.initialize();
  pages.config.registerOnSaveHandler(async (saveEvent) => {
    try {
      await pages.config.setConfig({
        entityId: "chatuit-sidepanel",
        contentUrl: new URL("sidepanel.html", window.location.href).href,
        suggestedDisplayName: "ChatUiT",
      });
      saveEvent.notifySuccess();
    } catch (error) {
      saveEvent.notifyFailure(String(error));
    }
  });
  pages.config.setValidityState(true);
}

start();
