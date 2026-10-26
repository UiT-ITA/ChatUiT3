# ChatUiT for Office

The ChatUiT assistant as a task pane in Word, Excel, PowerPoint and Outlook on Windows and Mac desktop. The pane talks to the ChatUiT server's Responses API. Every app uses the server agent `office` and sends its own tools and instructions with every request.

## Layout

- `src/chat/` has the conversation engine and the chat UI. It uses no host API (enforced by lint), so the Teams side panel can reuse it later.
- `src/office/` has everything that uses Office.js:
  - `taskpane/` is the one page every Office app loads.
  - `hosts.ts` picks the app and checks its API sets.
  - `shared/` has what the apps share.
  - `word/`, `excel/`, `powerpoint/` and `outlook/` each have an `adapter.ts` and `tools/`.
- `manifests/office.xml` covers Word, Excel and PowerPoint. `manifests/outlook.xml` covers Outlook.
- `environments.js` has the dev and prod URLs, manifest IDs and names.
- `fixtures/` has the conversation tests.

## Development

Requirements: Node 22.15 or later, Microsoft 365 Apps (current channel), and the ChatUiT server running locally (`dotnet run --launch-profile https` in `../ChatUitReact.Server`, which listens on https://localhost:7254). The dev server serves the pane on https://localhost:3000 and forwards `/api` to that server.

| App | Windows | Mac |
| --- | --- | --- |
| Word | `npm run start:word` | `npm run start:word` |
| Excel | `npm run start:excel` | `npm run start:excel` |
| PowerPoint | `npm run start:powerpoint` | `npm run start:powerpoint` |
| Outlook | `npm run start:outlook` | `npm run dev-server`, then in Outlook: Get Add-ins > My add-ins > Add a custom add-in > Add from file > `manifests/outlook.xml` |

`npm run stop` stops the dev server and removes the sideloaded add-ins.

Checks: `npm run typecheck`, `npm run lint`, `npm run test:fixtures` and `npm run validate`.

## Distribution

The ChatUiT server serves the add-in under `/office/`. `dotnet publish` of `ChatUitReact.Server` runs `npm run build` here and copies `dist/` into its `wwwroot`, so every ChatUiT deploy ships the add-in too.

`npm run build` writes `dist/office/` with the prod manifests. They have their own IDs and the name "ChatUiT", so they can be installed next to "ChatUiT Dev". The server also serves them at `/office/office.xml` and `/office/outlook.xml`.

Upload `office.xml` and `outlook.xml` once in the Microsoft 365 admin center under Integrated apps. After that, a deploy reaches users without a new upload. Only manifest changes need one.

The prod host is set in `environments.js`. Changing it changes the manifests, so they must be uploaded again.
