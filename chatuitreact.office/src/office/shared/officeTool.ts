/* global Office */

import type { HostAdapter } from "../../chat/host";
import type { ClientToolDefinition } from "../../chat/tools/types";

/** An Office requirement set, such as ExcelApi 1.9. */
export interface RequirementSet {
  set: string;
  version: string;
}

/** A client tool for an Office app. hosts.ts drops it when the app does not support `requires`. */
export interface OfficeToolDefinition extends ClientToolDefinition {
  requires?: RequirementSet;
}

/**
 * What one Office app contributes: its chat adapter, typed with Office tools, and the API set it needs.
 * Every Office app talks to the same server agent (hosts.ts), so the app's rules go in `instructions`.
 */
export interface OfficeApp extends Omit<HostAdapter, "model" | "tools" | "getDocumentKey" | "getUserName"> {
  /** The app's name in messages, such as "Excel". */
  name: string;
  /** The oldest API set ChatUiT works with in this app. */
  minimum: RequirementSet;
  tools: readonly OfficeToolDefinition[];
}

export function isSetSupported(requirement: RequirementSet): boolean {
  return Office.context.requirements.isSetSupported(requirement.set, requirement.version);
}
