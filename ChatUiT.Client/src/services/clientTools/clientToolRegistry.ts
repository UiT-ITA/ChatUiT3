import type { ClientToolDeclarationDto, ToolPreviewDto } from "../../types/chatModels";

/** Server tool ids never start with `client_`, so the two sets cannot collide. */
export const CLIENT_TOOL_NAME = /^client_[a-z0-9_]{1,50}$/;

export interface ClientToolContext {
  chatId: string;
  messageId: string;
  toolCallId: string;
  /** Aborted when the call is no longer wanted. */
  signal: AbortSignal;
}

export interface ClientToolResult {
  result: string;
  isError?: boolean;
}

/**
 * A tool this client runs itself when the model calls it. The declaration is sent with every
 * message; the handler runs when a message waits on a call to it. A tool with `preview` asks the
 * user first: the preview is shown in the approval card, and the handler runs only once the user
 * approves.
 */
export interface ClientToolDefinition<TArgs = unknown> {
  name: string;
  /** Written for the model. */
  description: string;
  /** JSON Schema object describing the arguments. */
  parameters: Record<string, unknown>;
  /** What the user approves before the handler runs. Must have no side effects. */
  preview?: (args: TArgs) => ToolPreviewDto | Promise<ToolPreviewDto>;
  handler: (args: TArgs, context: ClientToolContext) => Promise<ClientToolResult | string>;
}

const registry = new Map<string, ClientToolDefinition>();

/** Registers a tool for this client. Returns a function that unregisters it. */
export function registerClientTool<TArgs>(definition: ClientToolDefinition<TArgs>): () => void {
  if (!CLIENT_TOOL_NAME.test(definition.name)) {
    throw new Error(`Client tool name "${definition.name}" must match ${CLIENT_TOOL_NAME}`);
  }
  if (registry.has(definition.name)) {
    throw new Error(`Client tool "${definition.name}" is already registered`);
  }
  registry.set(definition.name, definition as ClientToolDefinition);
  return () => {
    if (registry.get(definition.name) === definition) {
      registry.delete(definition.name);
    }
  };
}

export function getClientTool(name: string): ClientToolDefinition | undefined {
  return registry.get(name);
}

/** What goes on the wire with each message. */
export function getClientToolDeclarations(): ClientToolDeclarationDto[] {
  return Array.from(registry.values()).map(tool => ({
    name: tool.name,
    description: tool.description,
    parametersSchema: tool.parameters,
  }));
}
