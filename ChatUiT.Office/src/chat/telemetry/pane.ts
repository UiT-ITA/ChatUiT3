/* global console */

import { requestScopesSilently } from "../auth/accountManager";
import { API_SCOPES } from "../config";
import { startTelemetry, trackError, type ClientApp } from "./telemetryService";

/** Starts telemetry for a pane, with tokens for the ChatUiT API that never open a sign-in. */
export function startPaneTelemetry(app: ClientApp, route: string): void {
  startTelemetry({ app, route, getToken: () => requestScopesSilently(API_SCOPES) });
}

/** React's onUncaughtError: records the error as client.error of kind render and logs it to the console. */
export function reportRenderError(error: unknown): void {
  trackError("render", { message: "A component failed to render", error });
  console.error(error);
}
