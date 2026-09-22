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

Section `InternalAgents`: `Models` maps an agent id to the `Model.Id` (the GUID from the Models admin page) it
runs on. An agent without an entry runs on the calling chat's model.

## Internal agents

Code under `ChatUitReact.Server/Services/Agents/`. An internal agent is an `InternalAgent` subclass: `Id`,
`DisplayName`, `Description` (what the outer model reads to decide when to delegate), `SystemPrompt`,
`Functions` (private `ITool` instances), `DefaultPolicy`, `MaxRounds`. `AddInternalAgent<TAgent>()` registers
it and wraps it in `InternalAgentTool`, so from then on it is an ordinary tool: it appears in the registry, the
admin Tools page (with its functions listed read-only), the assistant editor, and access policies apply to it as
a whole.

Internal agents are code only. They are never stored and have no editor. They are unrelated to system
assistants, which are ordinary assistant documents.

How a call runs: the outer model calls the agent with one `task` string. `InternalAgentRunner` starts a nested
conversation on the agent's model with the agent's prompt, the task as the only user message and the agent's
functions as tools, and loops until the inner model answers without calling functions (or `MaxRounds` is spent,
after which pending calls get a "budget exhausted" error and the model is expected to answer). The final text
is the tool result. Inner thinking and intermediate text are discarded.

Inner functions run through the normal `IToolExecutor`, so consent and confirmation work unchanged. Their pauses
are forwarded under the outer tool call id (the only id the client knows), which `IStreamingTool` makes possible:
a tool that yields `ToolExecutionEvent`s instead of returning one result. Two consequences:

- Inner functions are executed one at a time.
- Inner confirmable functions must return previews with `AllowEdit = false`, because the respond endpoint can
  only validate edits against the outer tool's schema.

Adding an agent:

1. Write the functions as `Tool<TArgs>` / `ConfirmableTool<TArgs>` classes under `Services/Agents/<Name>/Functions/`.
   They need no policy (leave `DefaultPolicy` at its default) and are not registered as `ITool` in DI; register
   them as their concrete types and inject them into the agent.
2. Subclass `InternalAgent`. Keep `Description` about *what to delegate and what to include in the task*: the
   agent cannot see the conversation.
3. Call `services.AddInternalAgent<MyAgent>()` from `AddInternalAgents` (or a per-area extension like
   `AddM365Agents`).
4. Optionally pin a model in `InternalAgents:Models`.

Shipped agents: `m365_reader` (people, presence, calendar, free/busy, Teams chats, file search and text file
reading) and `m365_writer` (the same plus sending Teams messages, creating group chats and writing text files
to OneDrive; every write is confirmed). The writer's code default allows the Admin role only.

Future top-level use (for example a fixed agent inside an Office add-in) needs only a `ChatService` entry point
that builds the `AiRequest` from an `InternalAgent` instead of an assistant document; the definition itself does
not change.

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
