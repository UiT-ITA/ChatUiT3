/* eslint-disable no-undef */

/**
 * Where each build runs. The manifests in manifests/ hold the dev values. A production build
 * writes them with the prod values, so a dev and a prod add-in can be installed side by side.
 *
 * - addinUrl: where the task pane is served, with a trailing slash.
 * - apiHosts (dev): the ChatUiT servers the dev pane can switch between, by name. The first is the default.
 *   An empty origin is the page's own, where the dev server forwards /api to the local server.
 * - apiOrigin (prod): the ChatUiT server.
 * - officeId, outlookId: the <Id> of manifests/office.xml and manifests/outlook.xml.
 * - teamsId: the id of manifests/teams/manifest.json.
 * - appUrl: the ChatUiT web app, which the Teams app opens as its personal tab, with a trailing slash.
 */
module.exports = {
  dev: {
    addinUrl: "https://localhost:3000/",
    apiHosts: {
      local: "",
      remote: "https://chatuit-v3-ekguc0ase9dghpdn.westeurope-01.azurewebsites.net",
    },
    officeId: "c1b06178-4084-4a0e-8f1e-7acddec18832",
    outlookId: "c1ad446e-b336-45b6-9cb8-0e44e45efe6f",
    teamsId: "710c5ca9-1683-4672-a752-0c5e99516620",
    appUrl: "https://localhost:54979/",
    displayName: "ChatUiT Dev",
  },
  prod: {
    // The ChatUiT server serves the add-in under /office/. Moves to the custom domain once it is set up.
    addinUrl: "https://chatuit-v3-ekguc0ase9dghpdn.westeurope-01.azurewebsites.net/office/",
    apiOrigin: "https://chatuit-v3-ekguc0ase9dghpdn.westeurope-01.azurewebsites.net",
    officeId: "83d5aa2b-d922-464a-b960-2ab502bf6e38",
    outlookId: "7f1db9e3-4784-4e05-9e69-391e99663791",
    teamsId: "5c85654e-ca19-45b9-b2a5-ca1487e9453d",
    appUrl: "https://ki-beta.uit.no/",
    displayName: "ChatUiT",
  },
};
