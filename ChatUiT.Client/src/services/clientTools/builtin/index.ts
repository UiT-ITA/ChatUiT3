import { registerClientTool } from "../clientToolRegistry";
import { getClientTimeTool } from "./getClientTime";

let registered = false;

/** Tools every web client offers. Add-ins register their own on top. */
export function registerBuiltinClientTools(): void {
  if (registered) return;
  registered = true;
  registerClientTool(getClientTimeTool);
}
