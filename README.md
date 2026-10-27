# ChatUiT

ChatUiT is UiT's AI chat service. Users sign in with their UiT account and chat with the models and assistants the service offers, in the browser and in Microsoft Office.

## Parts

| Folder | What it is |
| --- | --- |
| `ChatUiT.Server/` | ASP.NET Core server: the API, the Responses API, SignalR and the static files of both front ends. |
| `ChatUiT.Client/` | The web app (React and Vite). |
| `ChatUiT.Office/` | The Office add-in for Word, Excel, PowerPoint and Outlook (React and webpack). See its [README](ChatUiT.Office/README.md). |
| `docs/` | Design notes. [tools.md](docs/tools.md) covers tools, agents and the Entra ID setup. |

## Prerequisites

- .NET 10 SDK
- Node 22
- A trusted ASP.NET dev certificate: `dotnet dev-certs https --trust`
- Server configuration in `appsettings.json` and .NET user secrets

## Run locally

Server and web app:

```bash
dotnet run --project ChatUiT.Server --launch-profile https
```

This starts the server and the Vite dev server for the web app. The web app is at https://localhost:54979.

Office add-in, with the server running:

```bash
cd ChatUiT.Office && npm install && npm run start:word
```

`start:excel`, `start:powerpoint` and `start:outlook` open the other apps. The add-in's [README](ChatUiT.Office/README.md) has the details.

## Deploy

A push to `master` runs `.github/workflows/master_chatuit-v3.yml`. It publishes the server with the web app and the add-in in one package and deploys it to the `ChatUiT-V3` Azure Web App.

The Office add-in manifests are uploaded once in the Microsoft 365 admin center, and again only when a manifest changes. See the add-in's [README](ChatUiT.Office/README.md#distribution).
