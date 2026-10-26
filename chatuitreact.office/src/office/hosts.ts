/* global Office */

import type { HostAdapter } from "../chat/host";
import type { ClientToolDefinition } from "../chat/tools/types";
import { isSetSupported, type OfficeApp, type OfficeToolDefinition, type RequirementSet } from "./shared/officeTool";
import { excelApp } from "./excel/adapter";
import { getOfficeLoginHint } from "./shared/loginHint";
import { outlookApp } from "./outlook/adapter";
import { powerPointApp } from "./powerpoint/adapter";
import { wordApp } from "./word/adapter";

/** The server agent of every Office app. Each app sends its own rules as instructions. */
const OFFICE_MODEL = "office";

/** Sign-in uses nested app authentication, which every app needs. */
const NESTED_APP_AUTH: RequirementSet = { set: "NestedAppAuth", version: "1.1" };

export type HostResult = { adapter: HostAdapter } | { message: string };

function appFor(host: Office.HostType | null): OfficeApp | null {
  switch (host) {
    case Office.HostType.Word:
      return wordApp;
    case Office.HostType.Excel:
      return excelApp;
    case Office.HostType.PowerPoint:
      return powerPointApp;
    case Office.HostType.Outlook:
      return outlookApp;
    default:
      return null;
  }
}

/**
 * The chat adapter for the Office app, or the message to show instead. Call it after Office.onReady,
 * because it checks the app's API sets and drops the tools whose set the app lacks.
 */
export function resolveHost(host: Office.HostType | null): HostResult {
  const app = appFor(host);
  if (!app) {
    return { message: "Open ChatUiT from Word, Excel, PowerPoint or Outlook." };
  }
  if (!isSetSupported(NESTED_APP_AUTH) || !isSetSupported(app.minimum)) {
    return { message: `ChatUiT needs a newer version of ${app.name}.` };
  }
  return {
    adapter: {
      logoUrl: "assets/icon-64.png",
      emptyMessage: app.emptyMessage,
      starters: app.starters,
      model: OFFICE_MODEL,
      instructions: app.instructions,
      tools: app.tools.filter((tool) => !tool.requires || isSetSupported(tool.requires)).map(toClientTool),
      getContext: app.getContext,
      getDocumentKey: host === Office.HostType.Outlook ? outlookThreadKey : documentUrlKey,
      noDocumentMessage: app.noDocumentMessage,
      getUserName: getOfficeLoginHint,
      MenuItems: app.MenuItems,
    },
  };
}

/** The file's path or URL. Empty for a file that was never saved. */
async function documentUrlKey(): Promise<string | null> {
  return Office.context.document.url || null;
}

/** The selected email's thread. Null for a new email. */
async function outlookThreadKey(): Promise<string | null> {
  return Office.context.mailbox.item?.conversationId || null;
}

function toClientTool(tool: OfficeToolDefinition): ClientToolDefinition {
  return { name: tool.name, description: tool.description, parameters: tool.parameters, handler: tool.handler };
}
