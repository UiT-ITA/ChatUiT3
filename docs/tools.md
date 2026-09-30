# Assistant tools

How tools work, how to add one, and how access is controlled. Code lives under
`ChatUitReact.Server/Services/Tools/` on the server and `chatuitreact.client/src/services/clientTools/`
on the client.

## Concepts

- **Tool**: something the model can call. Server tools implement `ITool`; client tools are declared by the
  client with each message and run in the browser or add-in.
- **Tool id**: a stable snake_case string (`get_weather`). It is also the function name the model sees and
  the key the access policy is stored under. Never rename an id; add the old one to `LegacyIds` instead.
- **Access policy**: `Enabled`, `AllowedRoles`, `AllowedGroupIds`. A user may use a tool when it is enabled
  and they hold any listed role or belong to any listed Entra group. Every tool has a code default; an admin
  can store an override in the Tools admin page.
- **Internal agent**: a code-defined nested model loop with its own prompt and private functions, exposed to
  assistants as one tool with a single `task` argument. See [Internal agents](#internal-agents).
- **Assistant tool list**: `ChatSettings.AvailableToolIds`. Tool policies apply to private assistants (owned
  and shared). System assistants ignore them: their own `Access` (roles and Entra groups, null = everyone)
  decides who may see and use them, and whoever is admitted gets every tool on them.

## Adding a server tool

1. Create a folder `Services/Tools/<Name>/` with one class.
2. Define an args record with `[Description]` on every member. Nullable members are optional; the rest are
   required. Enums serialise camelCase.
3. Derive from `Tool<TArgs>`, or `ConfirmableTool<TArgs>` when the tool has side effects the user must approve
   (anything that writes or sends).
4. Set `Id`, `DisplayName`, `Description` (written for the model), `DefaultPolicy`, and `RequiredScopes`
   when the tool calls Microsoft Graph on the user's behalf.
5. Register it in `ToolServiceCollectionExtensions.AddTools`: `services.AddSingleton<ITool, MyTool>();`
6. Start the server. `ToolRegistry` validates the id (`^[a-z][a-z0-9_]{0,63}$`, unique, not `client_*`) and
   throws on a violation.

```csharp
public sealed record LookupArgs(
    [property: Description("What to look up.")] string Query,
    [property: Description("Max results. Defaults to 10.")] int? Limit);

public sealed class LookupTool : Tool<LookupArgs>
{
    public override string Id => "lookup_thing";
    public override string DisplayName => "Lookup Thing";
    public override string Description => "Looks up a thing by name and returns its details.";
    public override ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.ForRoles(UserRole.Beta);

    protected override async Task<ToolResult> ExecuteAsync(LookupArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        // invocation.Context: UserId, ChatId, MessageId, Access (roles + groups), Tokens (delegated tokens)
        return ToolResult.Ok(new { items = new[] { "a", "b" } }, display: "2 items");
    }
}
```

`ToolResult.Content` goes to the model (cut at `Tools:MaxModelContentChars`); `Display` is what the user sees in
the activity panel. Throw `ToolArgumentException` for bad arguments; the message is written for the model.

### Per-request tools

A tool can also be built for one request instead of registered in DI, when what it does depends on the
assistant or chat it runs for. `LoadKnowledgeFileTool` (`Services/Tools/Knowledge/`) is one: `ChatService`
constructs it with the assistant's on-demand files still loadable and adds it to `AiRequest.Tools`, and
`AssistantService` constructs it the same way to count its definition. Rules for such a tool:

- It is not in `ToolRegistry`, so it never appears in the tool picker and cannot be stored in
  `AvailableToolIds`. Its id must still match `^[a-z][a-z0-9_]{0,63}$` and must not collide with a registered
  id, since the conversation runner matches calls by id across `AiRequest.Tools`.
- Access falls back to the tool's `DefaultPolicy`; admins cannot override it in `ToolPolicies`.
- The executor runs it like any other server tool: same output cap, same confirmation and consent routing.

### Delegated Microsoft Graph access

Call `await invocation.Context.Tokens.GetAccessTokenAsync(RequiredScopes, ct)` and use the token with
`IHttpClientFactory`. When the user has not consented, the call throws `ConsentRequiredException`; the executor
pauses the run, the client shows a consent card, the user grants the scopes through MSAL, and the tool is retried
with the same arguments. Do not catch that exception in the tool.

### Confirmation

`ConfirmableTool<TArgs>` splits the call in two. `PrepareAsync` validates and returns a `ToolPreview` (title,
optional markdown summary, label/value fields, `AllowEdit`). Nothing may change state there. The user sees the
preview and approves or rejects; on approve `CommitAsync` runs with the arguments the user approved, edited if
`AllowEdit` was true. A rejection or a timeout is reported to the model as a declined action.

## Client tools

A client tool is declared and executed by the client. The web app registers them in
`src/services/clientTools/builtin/`; an Office add-in registers its own.

```ts
registerClientTool({
  name: "client_get_selection",               // must match /^client_[a-z0-9_]{1,50}$/
  description: "Return the text the user has selected in the document.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async handler(args, ctx) { return JSON.stringify({ text: await readSelection(ctx.signal) }); },
});
```

Every send carries `getClientToolDeclarations()`. When the model calls one, the server emits a
`ToolClientCallRequested` chunk, the client store runs the handler after the flush is applied (so a replayed,
already finished call is not run again), and posts the result to the respond endpoint. Handlers should be
idempotent: two open tabs both receive the call, and the second result gets a 409.

Access for client tools is one policy, id `client_tools` (default: everyone). Server tool ids never start with
`client_`, so the two namespaces cannot collide. Declarations are capped by `Tools:MaxClientTools` and
`Tools:MaxClientSchemaBytes` and must be object schemas.

## Wire contract

Stream chunk kinds added by the tool system, all on `ReceiveMessageChunk`:

| kind | fields |
|---|---|
| `ToolStart` | toolCallId, toolName, argumentsJson, execution |
| `ToolConfirmationRequested` | toolCallId, toolName, argumentsJson, preview, timeoutMs |
| `ToolConsentRequired` | toolCallId, toolName, requiredScopes, timeoutMs |
| `ToolClientCallRequested` | toolCallId, toolName, argumentsJson, timeoutMs |
| `ToolStatus` | toolCallId, status (`approved`, `running`) |
| `ToolEnd` | toolCallId, toolName, result, isError, status (`completed`, `rejected`, `timeout`, `error`) |

`timeoutMs` counts from the chunk's `elapsedMs`. While a call waits, the generation deadline is suspended.

Respond: `POST /api/chats/{chatId}/messages/{messageId}/tool-calls/{toolCallId}/respond` with one of

```json
{ "kind": "confirmation", "decision": "approve", "editedArgumentsJson": null }
{ "kind": "consent", "decision": "retry" }
{ "kind": "clientResult", "result": "…", "isError": false }
```

200 `{ accepted: true, status }`; 409 `{ accepted: false }` when nothing is pending (answered elsewhere or timed
out); 400 when the response does not match what the call is waiting for or `editedArgumentsJson` is not an object.
A consent retry uses the bearer token of the respond request for the On-Behalf-Of exchange.

Persisted `ActivityEntry` carries `execution`, `status` (terminal), `preview` and `requiredScopes` so history
shows what the user approved or declined.

## Access enforcement points

1. `GET /api/assistants/tools` lists only tools the caller may use, so the picker never offers a disallowed tool.
2. Assistant create and update (user endpoints) return 400 `tools_not_allowed` when the request names a tool the
   owner may not use (a stale client or a hand-made request). Admin system-assistant endpoints only reject
   unknown ids and validate `Access.AllowedGroupIds` as GUIDs.
3. Shared assistants: `POST /api/assistants/shared/{id}` returns 400 `tools_not_allowed` with a `message` naming
   the tools when the assistant carries tools the caller may not use. A shared assistant already in the list is
   removed, with a `Notify` warning saying why, when the assistant list loads or when a message is sent with it.
4. System assistants a user does not match (`Assistant.Access`) are left out of the list; sending a message with
   one is refused with a `Notify` error.
5. Generation intersects the assistant's tool list with the current user's access for private and shared
   assistants only; system assistants resolve their list as stored. The executor then re-checks the policy
   before each call on enforced runs.

The admin assistant editor offers every tool and marks a selected tool in yellow when the assistant admits
users the tool's own policy does not (a heads-up, not a block).

Admin API: `GET /api/admin/tools`, `GET /api/admin/tools/{id}`, `PUT /api/admin/tools/{id}/policy`,
`DELETE /api/admin/tools/{id}/policy` (back to code default). Policies live in the `ToolPolicies` container of
the Configuration database.

## Configuration

`appsettings.json` section `Tools`: `MaxModelContentChars`, `ConfirmationTimeout`, `ConsentTimeout`,
`ClientToolTimeout`, `MaxClientTools`, `MaxClientSchemaBytes`.

## Internal agents

ChatUiT has two kinds of agent: app-created agents (assistants, including system assistants, which are
ordinary assistant documents) and internal agents, defined in code under `ChatUitReact.Server/Services/Agents/`.

An internal agent is a definition: an `InternalAgent` subclass with `Id`, `DisplayName`, `Description` (what the
outer model reads to decide when to delegate), `SystemPrompt`, `Functions` (private `ITool` instances),
`DefaultPolicy` and `MaxRounds`. The shipped agents are all instances of it and differ only in name and config:

- `m365_reader`: people, presence, calendar, free/busy, Teams chats, file search and text file reading.
- `m365_writer`: the same plus sending Teams messages, creating group chats and writing text files to OneDrive;
  every write is confirmed. Its code default allows the Admin role only.
- `office_word`: the Word add-in's agent. Its only function is the `m365_reader` agent tool; the document tools
  are declared by the add-in with each request.
- `dev_probe` (Development only): its one function, `dev_echo`, is confirmable and has no side effects, so the
  confirmation path of the Responses API can be tested.

Registration (`InternalAgentServiceCollectionExtensions`):

- `AddInternalAgent<TAgent>()` registers the definition only. `IInternalAgentRegistry` lists every definition and
  validates at startup that ids follow the tool id rule and are unique, and that function ids are unique within
  each agent.
- `AddInternalAgentTool<TAgent>()` is opt-in. It registers the `InternalAgentTool` that calls the agent, once,
  keyed by the agent's type, and puts that instance in the tool registry. From then on the agent is also an
  ordinary tool: it appears in the admin Tools page (with its functions listed read-only), the assistant editor,
  and tool access policies apply to it as a whole. Another agent takes it as a function with
  `[FromKeyedServices(typeof(TAgent))]`. `m365_reader` and `m365_writer` have tools; `office_word` and
  `dev_probe` do not.

Model and reasoning level: one admin setting per agent, `{agentId, modelId, reasoningEffort}`, edited under Admin >
Internal agents (`GET /api/admin/internal-agents`, `PUT /api/admin/internal-agents/{id}`) and stored in the
`InternalAgents` container of the Configuration database. The model must support function calling; the effort is
clamped to what the model accepts. The setting applies to every run of the agent. The caller's roles on that
model are not checked.

One setup for every run: `InternalAgentRunner.SetupAsync` turns the agent and the run's context into the model and
endpoint, system prompt, parameters, functions and round budget. The same setup is used by both runs:

- Model: the admin setting. A nested run falls back to the chat's model at its lowest reasoning level. The
  Responses API has no chat model, so an agent without a setting is not usable there.
- System prompt: the agent's prompt, the current date and time, and the signed-in user.
- Temperature 0.2.
- Round budget: once `MaxRounds` is reached, the calls get "budget exhausted" results and the model must answer.
  The Responses API counts rounds across requests.

The two loops stay separate:

- Nested run (`InternalAgentRunner.RunAsync`, through the agent tool): the outer model calls the agent with one
  `task` string, which is the only user message. The loop runs until the inner model answers without calling
  functions, and the final text is the tool result. Inner reasoning summaries are reported as progress only;
  intermediate text is discarded.
- API run (`ResponsesRunner`, `/api/v1/responses`): the client sends the history, items stream back, client
  tools and approvals are handled. The agent's functions are its server tools. Raw models use this loop too.

Inner functions run through the normal `IToolExecutor`, so consent and confirmation work unchanged. Their pauses
are forwarded under the outer tool call id (the only id the client knows), which `IStreamingTool` makes possible:
a tool that yields `ToolExecutionEvent`s instead of returning one result. Two consequences:

- Inner functions are executed one at a time.
- Inner confirmable functions must return previews with `AllowEdit = false`, because the respond endpoint can
  only validate edits against the outer tool's schema.

Access:

- Through its tool, the agent is gated by the tool's policy: `DefaultPolicy` until an admin stores an override.
- Through the Responses API, an agent needs both its API catalog entry's policy and its `DefaultPolicy`.
- Exposure rule: nested approvals cannot be resumed through the Responses API, because a pause inside a nested
  agent ends the outer call, which then runs again in full. So an agent can only be exposed if none of its
  functions is an agent tool whose agent has confirmable functions. This is checked when the catalog entry is
  saved and when it is resolved. Chats wait in place and have no such limit.

Adding an agent:

1. Write the functions as `Tool<TArgs>` / `ConfirmableTool<TArgs>` classes under `Services/Agents/<Name>/Functions/`.
   They need no policy (leave `DefaultPolicy` at its default) and are not registered as `ITool` in DI; register
   them as their concrete types and inject them into the agent.
2. Subclass `InternalAgent`. Keep `Description` about *what to delegate and what to include in the task*: the
   agent cannot see the conversation.
3. Call `services.AddInternalAgent<MyAgent>()` from `AddInternalAgents` (or a per-area extension like
   `AddM365Agents`), and `services.AddInternalAgentTool<MyAgent>()` if assistants or other agents should call it.
4. Set its model under Admin > Internal agents.

## Entra ID checklist (TODO outside the code)

- **Client secret or certificate** on the API app registration, in user secrets as `EntraId:ClientSecret`.
  On-Behalf-Of needs it; without it every tool with `RequiredScopes` reports consent required forever.
- **Graph delegated permissions** on the same registration for whatever scopes future tools declare in
  `RequiredScopes`. The SPA and the API share one registration, so consent granted in the browser covers the exchange.
- **Groups claim**: in Token configuration add the `groups` claim for access tokens, and choose
  "Groups assigned to the application". Users are in many groups; the unrestricted claim overflows at about 200
  and Entra then sends an overage marker instead, which the server treats as no groups.
- **Assign groups** to the enterprise application, then paste each group's object id into the tool's policy in the
  admin page.
- Scale-out note: the token cache and the pending-interaction registry are in-process. A second server instance
  needs a distributed cache and a backplane before confirmations work across nodes.
