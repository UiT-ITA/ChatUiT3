# Error codes

Every error a user can see shows a code and, when the server was involved, a reference:
`The response could not be completed. (E2001, ref 3f9a1c2e)`.

- The code (`E` + 4 digits) names one kind of error. A code is never reused for another kind.
- The reference is the first 8 hex digits of the request's trace id. In Application Insights it
  finds every log line of that request: `union * | where operation_Id startswith "3f9a1c2e"`.
  The server sends it on every HTTP response in the `X-ChatUiT-Ref` header.

## Ranges

| Range | Area | Defined in |
|---|---|---|
| E1000–E1999 | Web client | ChatUiT.Client |
| E2000–E2099 | Chat generation and Responses API (server) | ChatUiT.Server/Errors |
| E2100–E2299 | AI provider failures (server) | ChatUiT.Server/Errors |
| E3000–E3999 | Office add-in | ChatUiT.Office |
| E4000–E4999 | REST and admin endpoints (server) | ChatUiT.Server/Errors |
| E5000–E5499 | Files and media generation (server) | ChatUiT.Server/Errors |
| E5500–E5799 | Files in the web client | ChatUiT.Client |
| E5800–E5999 | File import in the Office add-in | ChatUiT.Office |

## E1000–E1999 Web client

Paths are relative to ChatUiT.Client/src. Server texts that already carry a code are shown as they are.

| Code | Message | Cause | Where |
|---|---|---|---|
| E1000 | Network error. Please check your connection and try again. | Request did not reach the server | services/apiService.ts |
| E1001 | You are not signed in. Reload the page to sign in. | API call without token or account | services/apiService.ts |
| E1002 | You are not authorized to perform this action. | HTTP 401 with no server message | services/apiService.ts |
| E1003 | You are not authorized to perform this action. | HTTP 403 with no server message | services/apiService.ts |
| E1004 | Resource not found. | HTTP 404 with no server message | services/apiService.ts |
| E1005 | The request is too large to send. | HTTP 413 with no server message | services/apiService.ts |
| E1006 | Rate limit reached. Please try again. | HTTP 429 with no server message | services/apiService.ts |
| E1007 | Internal server error. Please try again. | HTTP 5xx with no server message | services/apiService.ts |
| E1008 | Request failed (n). | Any other status with no server message | services/apiService.ts |
| E1009 | (the server's text) | Server error text with no code and no errorCode | services/apiService.ts |
| E1010 | One or more of the selected tools are not available to you. | Legacy `tools_not_allowed` with no message | services/apiService.ts |
| E1011 | One or more of the selected knowledge sources are not available to you. | Legacy `knowledge_sources_not_allowed` | services/apiService.ts |
| E1012 | One or more of the selected tools do not exist. | Legacy `invalid_tools` | services/apiService.ts |
| E1013 | One or more group ids are not valid object ids. | Legacy `invalid_group_ids` | services/apiService.ts |
| E1014 | One or more of the selected knowledge sources do not exist. | Legacy `unknown_knowledge_sources` | services/apiService.ts |
| E1015 | The course has a new version. Reload the course and take the test again. | Legacy `course_version_changed` with no message | services/apiService.ts |
| E1020 | Could not connect to the server because you are not signed in. | No access token for the SignalR hub | services/signalrService.ts |
| E1021 | Could not open the live connection to the server. | SignalR start failed or disconnected | services/signalrService.ts, contexts/AuthContext.tsx |
| E1022 | Sign-in failed. | Teams sign-in error on the start screen | contexts/AuthContext.tsx |
| E1023 | Your training status could not be loaded. | Training status failed with no coded error | contexts/AuthContext.tsx |
| E1031 | Chat not found. You can start a new chat below. | Opened chat id does not exist | components/chat/ChatSurface.tsx |
| E1032 | The answer could not be sent. Try again. | Tool-call answer failed (not a 400) | hooks/useInteractionDock.ts |
| E1033 | Could not draw the diagram | Mermaid render or parse failed | components/common/MermaidDiagram.tsx |
| E1040 | Group search failed | Entra group search failed | components/common/GroupPicker.tsx |
| E1041 | The course could not be loaded. | Training course fetch failed | components/training/TrainingScreen.tsx |
| E1042 | Could not load this page. Try again later. | Help markdown missing or fetch failed | components/help/HelpPage.tsx |
| E1043 | Access Denied | Route needs a role the user lacks | components/layout/ProtectedRoute.tsx |
| E1044 | This assistant was not found. | Assistant id in URL does not exist | components/assistants/AssistantsPage.tsx |
| E1045 | (generate.notFound text) | Generation id in URL does not exist | components/generate/GeneratePage.tsx |
| E1046 | Not found. | Admin item id in URL does not exist | components/admin/* |
| E1050 | Application Insights is not configured. | Insights query returned `not_configured` | components/insights/InsightsCard.tsx |
| E1051 | The app has no read access to Application Insights. | Insights query returned `no_access` | components/insights/InsightsCard.tsx |
| E1052 | The query failed. | Insights query returned `query_failed` | components/insights/InsightsCard.tsx |
| E1053 | Could not load the data. | Insights page request failed | components/insights/InsightsCard.tsx |
| E1060 | The test could not be run. | Model test request threw with no coded error | components/admin/ModelEditorParts.tsx |
| E1061 | (raw error text) | Dev-only /status page load failed with no coded error | components/status/StatusPage.tsx |

## E2000–E2099 Chat generation and Responses API

Paths are relative to ChatUiT.Server. A provider failure gets its E21xx code instead of the fallback codes E2001, E2002 and E2023.

| Code | Message | Cause | Where |
|---|---|---|---|
| E2000 | The response could not be completed because an error occurred while generating it. | A message was still generating after 5 minutes with no active run. Shown without a ref, since it is found on a later read | Services/ChatService.cs |
| E2001 | (same text) | The send failed before the run started | Services/ChatService.cs |
| E2002 | (same text) | The run failed during generation | Services/ChatService.cs |
| E2003 | This chat allows red data, so it can only use red assistants. | A red chat was sent to a non-red assistant | Services/ChatService.cs |
| E2004 | Assistant is required. | The send has no assistant id | Services/ChatService.cs |
| E2005 | Selected model is unavailable or misconfigured. | The assistant's model or its endpoint is missing | Services/ChatService.cs |
| E2006 | The selected provider is not supported. | No provider is registered for the endpoint type | Services/ChatService.cs |
| E2007 | Selected assistant is invalid. | The assistant does not exist | Services/ChatService.cs |
| E2008 | Selected assistant has no model configured. | The assistant has no model | Services/ChatService.cs |
| E2009 | You do not have access to the assistant. | The user may not use a system assistant | Services/ChatService.cs |
| E2010 | The shared assistant was removed from your list: it uses tools you are not allowed to use. | Warning toast | Services/AssistantService.cs |
| E2020 | The server could not list the models. | GET /api/v1/models threw | Controllers/ResponsesController.cs |
| E2021 | The server could not read the model. | GET /api/v1/models/{id} threw | Controllers/ResponsesController.cs |
| E2022 | The server could not handle the request. | Preparing a response threw | Controllers/ResponsesController.cs |
| E2023 | The response could not be completed because an error occurred while generating it. | The run failed (Office) | Services/ResponsesApi/ResponsesRunner.cs |
| E2024 | The response stream failed. | The streaming worker crashed | Controllers/ResponsesController.cs |
| E2025 | The model does not exist or you do not have access to it. | Unknown model, or one the caller may not use | Services/ResponsesApi/ResponsesDtos.cs |
| E2026 | The request body is not valid JSON. | The body did not parse | Controllers/ResponsesController.cs |
| E2027 | The request body must be a JSON object. | The body is JSON null | Controllers/ResponsesController.cs |
| E2028 | model is required. | `model` is missing | Controllers/ResponsesController.cs |
| E2030 | store must be false or omitted: nothing is stored. | `store: true` | Services/ResponsesApi/ResponsesRequestMapper.cs |
| E2031 | tool_choice must be "auto". | Another tool_choice | ResponsesRequestMapper.cs |
| E2032 | Unsupported parameter. | An unknown request parameter | ResponsesRequestMapper.cs |
| E2033 | The parameter is only accepted for raw models; an agent uses its own settings. | temperature, max_output_tokens or effort sent to an agent | ResponsesRequestMapper.cs |
| E2034 | temperature must be between 0 and 2. | temperature out of range | ResponsesRequestMapper.cs |
| E2035 | max_output_tokens must be positive. | max_output_tokens <= 0 | ResponsesRequestMapper.cs |
| E2036 | Unsupported reasoning.effort. | Unknown effort value | ResponsesRequestMapper.cs |
| E2037 | This model cannot call functions. | Tools sent to a model without function calling | ResponsesRequestMapper.cs |
| E2038 | Only tools of type "function" are supported. | Tool type is not function | ResponsesRequestMapper.cs |
| E2039 | Strict function tools are not supported. | `strict: true` | ResponsesRequestMapper.cs |
| E2040 | Too many tools. | Tool count over the limit | ResponsesRequestMapper.cs |
| E2041 | A tool declaration is not valid. | A tool name or schema is invalid | ResponsesRequestMapper.cs |
| E2042 | input must be a string or an array of items. | `input` has the wrong shape | ResponsesRequestMapper.cs |
| E2043 | An input item must be an object. | An input item is not an object | ResponsesRequestMapper.cs |
| E2044 | The input item type is not supported. | Unknown item type | ResponsesRequestMapper.cs |
| E2045 | An input item is not valid. | The item did not deserialize | ResponsesRequestMapper.cs |
| E2046 | function_call needs call_id and name. | Incomplete function_call | ResponsesRequestMapper.cs |
| E2047 | A call_id appears twice. | Duplicate function_call call_id | ResponsesRequestMapper.cs |
| E2048 | No function_call with the call_id precedes the output. | Output with no preceding call | ResponsesRequestMapper.cs |
| E2049 | A call_id has two outputs. | Duplicate output | ResponsesRequestMapper.cs |
| E2050 | The approval request id is not valid. | The sealed approval id did not open | ResponsesRequestMapper.cs |
| E2051 | The approval request belongs to another model. | Approval for another model | ResponsesRequestMapper.cs |
| E2052 | No mcp_approval_request with the id precedes the response. | Approval response with no request | ResponsesRequestMapper.cs |
| E2053 | The approval request has two responses. | Duplicate approval response | ResponsesRequestMapper.cs |
| E2054 | mcp_call needs id and name. | Incomplete mcp_call | ResponsesRequestMapper.cs |
| E2055 | No function_call_output follows the call. | A call has no output | ResponsesRequestMapper.cs |
| E2056 | A call answered in an earlier response has no result in the input. | Missing result of an earlier answered call | ResponsesRequestMapper.cs |
| E2057 | No mcp_approval_response answers the approval request. | Unanswered approval request | ResponsesRequestMapper.cs |
| E2058 | chatuit_answers only answers questions. | Answers sent to a non-question | ResponsesRequestMapper.cs |
| E2059 | chatuit_edited_arguments is only accepted when the preview allows editing. | Edit where editing is not allowed | ResponsesRequestMapper.cs |
| E2060 | chatuit_edited_arguments is not valid JSON. | Edited arguments did not parse | ResponsesRequestMapper.cs |
| E2061 | chatuit_edited_arguments must be a JSON object. | Edited arguments are not an object | ResponsesRequestMapper.cs |
| E2062 | chatuit_edited_arguments does not answer questions. | Edit sent to a question | ResponsesRequestMapper.cs |
| E2063 | Questions are answered with chatuit_answers. | A question approved without answers | ResponsesRequestMapper.cs |
| E2064 | The answers do not fit the questions. | The answers fail validation | ResponsesRequestMapper.cs |
| E2065 | The message role is not supported. | Unknown role | ResponsesRequestMapper.cs |
| E2066 | output must be a string or an array of input_text and input_image parts. | Tool output has the wrong shape | ResponsesRequestMapper.cs |
| E2067 | Too many images in a tool output. | Over the image limit per output | ResponsesRequestMapper.cs |
| E2068 | The output part type is not supported. | Unknown output part | ResponsesRequestMapper.cs |
| E2069 | image_url must be a base64 data URL of a png, jpeg, gif or webp image. | Invalid image_url | ResponsesRequestMapper.cs |
| E2070 | The image is too large. | Image over the size limit | ResponsesRequestMapper.cs |
| E2071 | content must be a string or an array of parts. | Message content has the wrong shape | ResponsesRequestMapper.cs |
| E2072 | Too many files in a message. | Over the file limit per message | ResponsesRequestMapper.cs |
| E2073 | The content type is not supported. | Unknown content part | ResponsesRequestMapper.cs |
| E2074 | input_file needs a filename. | input_file without filename | ResponsesRequestMapper.cs |
| E2075 | input_file needs chunks: an array of input_text and input_image parts. | input_file without chunks | ResponsesRequestMapper.cs |
| E2076 | The chunk type is not supported. | Unknown chunk type | ResponsesRequestMapper.cs |

## E2100–E2299 AI provider failures

Set by `ProviderErrors` (ChatUiT.Server/Errors/ProviderErrors.cs). Rules are checked in this order: the provider's error code, then the message pattern, then the exception type, then the HTTP status.

| Code | Message | Cause | Where |
|---|---|---|---|
| E2100 | The conversation has too many images for the model. | Message contains "maximum number of images" (Azure), "too many images" or "too much media" (Anthropic) | ProviderErrors.Classify |
| E2101 | The model could not read one of the images. It may be damaged, too large or in an unsupported format. | Codes `invalid_image`, `invalid_image_format`, `invalid_image_url`, `image_parse_error`, `image_too_large`, `unsupported_image`, or an image-related message | ProviderErrors.Classify, FromStreamError |
| E2102 | The conversation is too long for the model. | Code `context_length_exceeded`, or "context length", "context window", "context limit", "maximum context", "prompt is too long" | ProviderErrors.Classify, FromStreamError |
| E2103 | The answer reached the model's length limit before it was finished. | Responses `response.incomplete` with reason `max_output_tokens` | OpenAiResponsesProtocol |
| E2104 | The message was blocked by the content filter of the model provider. | Code or innererror `content_filter`, `ResponsibleAIPolicyViolation`, `content_policy_violation`, `invalid_prompt`, or a content-policy message | ProviderErrors.Classify |
| E2105 | The answer was stopped by the content filter of the model provider. | Responses `response.incomplete` with reason `content_filter`, or the same codes in a stream error | OpenAiResponsesProtocol, FromStreamError |
| E2106 | The model declined to answer. | Anthropic `stop_reason: refusal` | AnthropicMessagesProtocol |
| E2107 | The model is receiving too many requests. Try again in a moment. | 429, `rate_limit_exceeded`, `rate_limit_error`, `RateLimitReached` | ProviderErrors.Classify, FromStreamError |
| E2108 | The usage quota for the model is used up. | `insufficient_quota`, `billing_error`, 402, quota or credit messages | ProviderErrors.Classify |
| E2109 | The server is not allowed to use the model. Contact an administrator. | 401/403, `invalid_api_key`, `authentication_error`, `permission_error` | ProviderErrors.Classify |
| E2110 | The model was not found at the provider. Contact an administrator. | 404, `model_not_found`, `DeploymentNotFound`, `not_found_error` | ProviderErrors.Classify |
| E2111 | The request is too large for the model. | 413, `request_too_large`, `string_above_max_length` | ProviderErrors.Classify |
| E2112 | The model could not accept the definition of one of the tools. | `invalid_function_parameters`, `param` starting with "tools", or a tool-schema message | ProviderErrors.Classify |
| E2113 | The model is overloaded or unavailable. Try again later. | 5xx, 529, `overloaded_error`, `api_error`, `server_error` | ProviderErrors.Classify, FromStreamError |
| E2114 | The model took too long to respond. | `TimeoutException`, SDK timeout cancellation, 408, 504, `timeout_error` | ProviderErrors.Classify |
| E2115 | The server could not connect to the model. | Status 0, `AnthropicIOException`, `HttpRequestException` without status, `HttpIOException`, `SocketException` | ProviderErrors.Classify |
| E2198 | The model provider rejected the request. | Any other 4xx | ProviderErrors.Classify |
| E2199 | The model provider failed to complete the request. | Any other provider failure, unknown stream error or incomplete reason | ProviderErrors.Classify, FromStreamError, FromIncompleteReason |

## E3000–E3999 Office add-in

Paths are relative to ChatUiT.Office/src. "Plus detail" means the underlying error text is appended.

| Code | Message | Cause | Where |
|---|---|---|---|
| E3001 | The response could not be completed because of an error in the add-in. | Unexpected add-in error during a response, plus detail | chat/conversation/conversation.ts, chat/api/client.ts |
| E3002 | ChatUiT could not reach the server. Check the network connection and try again. | Request never reached the server (network, CORS, DNS) | chat/api/client.ts |
| E3003 | The request to the ChatUiT server timed out. | SDK request timeout | chat/api/client.ts |
| E3004 | The response ended before it was complete. | Stream closed without `response.completed` | chat/conversation/conversation.ts |
| E3005 | The server could not complete the response. | `response.failed` whose message has no server code, plus detail | chat/conversation/conversation.ts |
| E3006 | The server reported an error while generating the response. | SSE `error` event whose message has no server code, plus detail | chat/api/client.ts |
| E3007 | The server did not accept your sign-in. Reopen the pane and try again. | HTTP 401 without a server code | chat/api/client.ts |
| E3008 | The server denied access to the request. | HTTP 403 without a server code | chat/api/client.ts |
| E3009 | The server could not find what the add-in asked for. | HTTP 404 without a server code | chat/api/client.ts |
| E3010 | Too many requests. Wait a moment and try again. | HTTP 429 without a server code | chat/api/client.ts |
| E3011 | The ChatUiT server failed to handle the request. | HTTP 5xx without a server code (proxy or gateway pages included), plus detail | chat/api/client.ts |
| E3012 | The server rejected the request. | Any other HTTP 4xx without a server code | chat/api/client.ts |
| E3101 | The sign-in was cancelled. | User cancelled the browser sign-in card or closed the MSAL popup | chat/auth/browserSignIn.ts, chat/auth/accountManager.ts |
| E3102 | The browser sign-in did not finish in time. | Browser sign-in had no result after 10 minutes | chat/auth/browserSignIn.ts |
| E3103 | The sign-in failed. | Entra returned an error to the browser sign-in, plus Entra's text | chat/auth/browserSignIn.ts, office/authdialog/index.tsx |
| E3104 | The sign-in could not be completed. | Entra token endpoint refused the code, plus detail | chat/auth/browserSignIn.ts |
| E3105 | The Microsoft sign-in failed. | MSAL popup sign-in failed for a reason other than cancel or blocked, plus detail | chat/auth/accountManager.ts |
| E3106 | Sign-in could not start. | MSAL initialization failed, plus detail | chat/auth/accountManager.ts |
| E3107 | The browser sign-in failed. | Any other browser sign-in failure, plus detail | chat/auth/accountManager.ts |
| E3110 | The sign-in could not be passed on to ChatUiT. | Sign-in relay POST returned an error status | office/authdialog/index.tsx |
| E3111 | The sign-in page could not reach ChatUiT. | Sign-in relay POST failed at network level | office/authdialog/index.tsx |
| E3201 | Wait for the current response to finish. | Approval or answer sent while a response runs | chat/conversation/conversation.ts |
| E3202 | Unknown approval request. | Answer to an approval id that does not exist | chat/conversation/conversation.ts |
| E3203 | This approval request is no longer pending. | Answer to an approval already answered | chat/conversation/conversation.ts |
| E3204 | Give one answer per question. | Answer count does not match the question count | chat/conversation/conversation.ts |
| E3205 | An answer picks an option or has text. | Every answer is empty | chat/conversation/conversation.ts |
| E3206 | This request does not allow edited arguments. | Edited arguments on a request without allow_edit | chat/conversation/conversation.ts |
| E3207 | Edited arguments must be a JSON object. | Edited arguments are not a JSON object | chat/conversation/conversation.ts |
| E3208 | The answer could not be sent. | Any other failure while answering in the approval card, plus detail | chat/ui/useInteractionDock.ts |
| E3301 | The saved chats could not be read. | History store (IndexedDB) could not list chats | chat/ui/Header.tsx |
| E3401 | Open ChatUiT from Word, Excel, PowerPoint or Outlook. | Pane opened in an unsupported host | office/hosts.ts |
| E3402 | ChatUiT needs a newer version of {app}. | Host lacks NestedAppAuth 1.1 or the app's minimum API set | office/hosts.ts |
| E3403 | Open ChatUiT from a Teams meeting. | Teams SDK initialization or context failed | teams/sidepanel/index.tsx |
| E3404 | The ChatUiT side panel could not be added. | Teams config save failed, plus detail | teams/config/index.ts |
| E3405 | The track changes setting could not be read. | Word track changes mode read failed, plus detail | office/word/TrackChangesMenuItem.tsx |
| E3406 | The track changes setting could not be changed. | Word track changes mode change failed, plus detail | office/word/TrackChangesMenuItem.tsx |

## E4000–E4999 REST and admin endpoints

Paths are relative to ChatUiT.Server. Error bodies are `{ "message": "<text> (E4xxx, ref …)", "errorCode": "E4xxx", "ref": "…" }` next to any older fields.

| Code | Message | Cause | Where |
|---|---|---|---|
| E4000 | Internal server error. | Unhandled exception in any request | Telemetry/GlobalExceptionHandler.cs |
| E4001 | The request is not valid. | Model binding or validation failed | Program.cs |
| E4002 | The mandatory training must be completed first. | Endpoint called before the training was passed | Services/Training/RequireTrainingFilter.cs |
| E4010 | Chat not found. | Unknown chat | Controllers/ChatsController.cs |
| E4011 | File not found. | Unknown chat file | Controllers/ChatsController.cs |
| E4012 | Red data requires a red assistant. | Red enabled with a non-red assistant | Controllers/ChatsController.cs |
| E4013 | The client tools are not valid. | Invalid client tool declarations | Controllers/ChatsController.cs |
| E4014 | The answer does not fit the tool call. | Invalid tool-call answer | Controllers/ChatsController.cs |
| E4015 | The tool call no longer waits for an answer. | 409 when the call is not waiting | Controllers/ChatsController.cs |
| E4016 | Chat name cannot be empty. | Empty rename | Controllers/ChatsController.cs |
| E4017 | Chat name is too long. | Rename longer than 200 characters | Controllers/ChatsController.cs |
| E4018 | Red data cannot be switched off once allowed. | Tried to turn red off | Controllers/ChatsController.cs |
| E4030 | File not found. | Unknown assistant file | Controllers/AssistantsController.cs |
| E4031 | The assistant uses tools you are not allowed to use. | Owner saved disallowed or unknown tools | Controllers/AssistantsController.cs |
| E4032 | The assistant uses knowledge sources you are not allowed to use. | Disallowed knowledge sources | Controllers/AssistantsController.cs |
| E4033 | The always loaded files use more tokens than the model allows. | Always-loaded files over the model's limit | Services/AssistantService.cs |
| E4034 | An on-demand file needs a description. | Selective file without description | Services/AssistantService.cs |
| E4035 | This assistant cannot be set as your default. | The model is not allowed as default | Controllers/AssistantsController.cs |
| E4036 | The shared assistant uses tools you are not allowed to use. | Adding a shared assistant was refused | Controllers/AssistantsController.cs |
| E4037 | Assistant not found. | File uploaded to an assistant the caller may not edit, or that does not exist | Controllers/AssistantsController.cs, Services/AssistantService.cs |
| E4100 | The assistant names tools that do not exist. | Admin: invalid tools | Controllers/AdminAssistantsController.cs |
| E4101 | The assistant names knowledge sources that do not exist. | Admin: unknown knowledge sources | Controllers/AdminAssistantsController.cs |
| E4102 | Group ids must be GUIDs. | Invalid group ids | Controllers/AdminAssistantsController.cs, Controllers/AdminToolsController.cs |
| E4103 | Invalid model ID. | System assistant created with an unknown model | Controllers/AdminAssistantsController.cs |
| E4104 | Route id does not match request body id. | Route id and body id differ | Controllers/AdminAssistantsController.cs, Controllers/AdminEndpointsController.cs |
| E4105 | Internal agent not found. | Unknown agent | Controllers/AdminInternalAgentsController.cs |
| E4106 | Choose the model the agent runs on. | Unknown model | Controllers/AdminInternalAgentsController.cs |
| E4107 | The model does not support function calling, which an agent needs. | Model cannot call functions | Controllers/AdminInternalAgentsController.cs |
| E4108 | The agent cannot be exposed in the API. | Nested agent with confirmable functions | Services/ApiCatalog/ApiCatalogService.cs |
| E4109 | Tool not found. | Unknown tool | Controllers/AdminToolsController.cs |
| E4110 | Unknown model id. | Settings name an unknown default or naming model | Controllers/AdminSettingsController.cs |
| E4111 | Unknown system assistant id. | Settings name an unknown default assistant | Controllers/AdminSettingsController.cs |
| E4112 | Endpoint not found. | Unknown endpoint | Controllers/AdminEndpointsController.cs |
| E4113 | Invalid endpoint type. | Unknown endpoint type | Controllers/AdminEndpointsController.cs |
| E4114 | Invalid auth method. | Unknown auth method | Controllers/AdminEndpointsController.cs |
| E4115 | The endpoint does not accept managed identity. Use an API key. | Managed identity on an unsupported endpoint type | Controllers/AdminEndpointsController.cs |
| E4116 | An API key is required. | API key auth without a key | Controllers/AdminEndpointsController.cs |
| E4117 | Model not found. | Unknown model | Controllers/AdminModelsController.cs |
| E4118 | Unknown token counting scheme. | Invalid scheme | Controllers/AdminModelsController.cs |
| E4119 | Unknown API protocol. | Invalid protocol | Controllers/AdminModelsController.cs |
| E4120 | Unknown data classification. | Invalid classification | Controllers/AdminModelsController.cs |
| E4121 | Unknown image API. | Invalid image API | Controllers/AdminModelsController.cs |
| E4122 | The model must make at least 1 image per request. | MaxImagesPerRequest < 1 | Controllers/AdminModelsController.cs |
| E4123 | The model must return at least one format. | No output formats | Controllers/AdminModelsController.cs |
| E4124 | The model must offer a size: presets, auto size or custom sizes. | No size option | Controllers/AdminModelsController.cs |
| E4125 | Every size preset needs a width and height above 0. | Invalid preset | Controllers/AdminModelsController.cs |
| E4126 | Partial images cannot be negative. | MaxPartialImages < 0 | Controllers/AdminModelsController.cs |
| E4127 | An editing model must take at least 1 input image and one input format. | Invalid editing capabilities | Controllers/AdminModelsController.cs |
| E4128 | The model id is its id in the API, so it must match ^[a-z0-9][a-z0-9._-]{0,63}$. | Exposed model id fails the pattern | Services/ApiCatalog/ApiCatalogService.cs |
| E4129 | The model id is an internal agent's id in the API. | Exposed model id clashes with an agent | Services/ApiCatalog/ApiCatalogService.cs |
| E4130 | Another model is already exposed in the API with this model id. | Duplicate exposed id | Services/ApiCatalog/ApiCatalogService.cs |
| E4131 | The model is of another type. | Update with the wrong model type | Controllers/AdminModelsController.cs |
| E4140 | The model's endpoint does not exist. | Model test: no endpoint | Controllers/AdminModelsController.cs |
| E4141 | No AI provider is registered for the endpoint type. | Model test: unsupported provider | Controllers/AdminModelsController.cs |
| E4142 | Models of this type cannot be tested yet. | Model test: unsupported type | Controllers/AdminModelsController.cs |
| E4143 | The model test failed. | Model test threw, not a provider failure | Controllers/AdminModelsController.cs |
| E4144 | The model returned no text. | Model test: empty text | Controllers/AdminModelsController.cs |
| E4145 | The model returned no image. | Model test: no image | Controllers/AdminModelsController.cs |
| E4200 | The course has a new version. Reload the course and take the test again. | Training version changed | Controllers/TrainingController.cs |
| E4201 | Unknown question. | Training answer to an unknown question | Controllers/TrainingController.cs |
| E4210 | Unknown range. | Insights range not recognised | Controllers/InsightsController.cs |
| E4211 | Insights are not configured. | No App Insights resource id | Models/Insights/InsightsDtos.cs |
| E4212 | The server has no access to the Insights data. | 401/403 or no token | Models/Insights/InsightsDtos.cs, Services/Insights/LogsQueryRunner.cs |
| E4213 | The Insights query failed. | Query failed or timed out | Models/Insights/InsightsDtos.cs, Services/Insights/LogsQueryRunner.cs |
| E4220 | Too many records in the batch. | Client telemetry batch over 100 records | Controllers/TelemetryController.cs |

## E5000–E5499 Files and media generation

Paths are relative to ChatUiT.Server. Where a site has its own detailed text (for example "The model accepts at most 4 input images."), that text is shown with the code. Several problems at once show as "A. B. (E5043, E5046, ref …)".

| Code | Message | Cause | Where |
|---|---|---|---|
| E5000 | The generation failed because of an error. | Image run threw, not a provider failure | Services/MediaGenerations/MediaGenerationService.cs |
| E5001 | The model did not finish in time. | Image run hit its deadline | Services/MediaGenerations/MediaGenerationService.cs |
| E5002 | The content filter blocked the request. | Image service content filter | Services/AiProviders/Images/ImageApiHttp.cs |
| E5003 | The image service is busy. Try again in a minute. | Image service returned 429 | Services/AiProviders/Images/ImageApiHttp.cs |
| E5004 | The image service rejected the request. | Image service returned another 4xx | Services/AiProviders/Images/ImageApiHttp.cs |
| E5005 | The image service failed. | Image service returned 5xx, or a stream error with no status | Services/AiProviders/Images/ImageApiHttp.cs |
| E5010 | A prompt is required. | Empty prompt | Controllers/MediaGenerationsController.cs, Services/AiProviders/Images/ImageParameterValidator.cs |
| E5011 | The image model does not exist or is not available to you. | Unknown or forbidden image model | Controllers/MediaGenerationsController.cs |
| E5012 | No default model is set up to refine prompts. | No usable default model | Services/MediaGenerations/ImagePromptRefiner.cs |
| E5013 | The prompt is too long to refine. | Prompt over the context | Services/MediaGenerations/ImagePromptRefiner.cs |
| E5014 | The model could not refine the prompt. | Refinement call threw, not a provider failure | Services/MediaGenerations/ImagePromptRefiner.cs |
| E5015 | The model returned no prompt. | Empty refinement | Services/MediaGenerations/ImagePromptRefiner.cs |
| E5016 | The image model's endpoint is missing or not supported. | Missing or unsupported endpoint | Controllers/MediaGenerationsController.cs |
| E5017 | The images are larger than the model accepts. | Upload over the body limit (413) | Controllers/MediaGenerationsController.cs |
| E5018 | The request is not valid JSON. | The `request` form field did not parse | Controllers/MediaGenerationsController.cs |
| E5019 | The request is empty. | `request` is null | Controllers/MediaGenerationsController.cs |
| E5020 | The file is not a PNG, JPEG or WebP image. | Input image, mask or markup has the wrong format | Controllers/MediaGenerationsController.cs |
| E5030 | The prompt is longer than the model accepts. | Over MaxPromptCharacters | Services/AiProviders/Images/ImageParameterValidator.cs |
| E5031 | A mask or markup needs an input image. | Overlay without input | ImageParameterValidator.cs |
| E5032 | The model cannot edit images. | Edit on a non-editing model | ImageParameterValidator.cs |
| E5033 | Too many input images. | Over MaxInputImages | ImageParameterValidator.cs |
| E5034 | The model does not accept the input image format. | Input format not accepted | ImageParameterValidator.cs |
| E5035 | An input image is larger than the model accepts. | Input image over the size limit | ImageParameterValidator.cs |
| E5036 | The model does not accept a mask. | Mask not supported | ImageParameterValidator.cs |
| E5037 | The model does not accept markup. | Markup not supported | ImageParameterValidator.cs |
| E5038 | A mask and markup cannot be used together. | Both sent | ImageParameterValidator.cs |
| E5039 | A mask or markup must be a PNG. | Overlay not PNG | ImageParameterValidator.cs |
| E5040 | A moderation level applies to generations only. | Moderation on an edit | ImageParameterValidator.cs |
| E5041 | The model takes only the prompt and the images when editing. | Generation settings on an edit | ImageParameterValidator.cs |
| E5042 | The model does not offer the size. | Size not a preset and custom sizes not supported | ImageParameterValidator.cs |
| E5043 | The model needs a size. | No size and no auto size | ImageParameterValidator.cs |
| E5044 | The model cannot pick the aspect ratio. | Auto aspect ratio not supported | ImageParameterValidator.cs |
| E5045 | The model does not offer the quality. | Quality not offered | ImageParameterValidator.cs |
| E5046 | Too many images per request. | Count outside 1..MaxImagesPerRequest | ImageParameterValidator.cs |
| E5047 | The model does not return the format. | Output format not offered | ImageParameterValidator.cs |
| E5048 | The model does not take a compression level. | Compression not supported | ImageParameterValidator.cs |
| E5049 | A compression level applies to JPEG and WebP only. | Compression with PNG | ImageParameterValidator.cs |
| E5050 | Compression is out of range. | Compression outside 0..100 | ImageParameterValidator.cs |
| E5051 | The model does not offer the background. | Background not offered | ImageParameterValidator.cs |
| E5052 | A transparent background needs PNG or WebP. | Transparent background with JPEG | ImageParameterValidator.cs |
| E5053 | The model does not offer the moderation level. | Moderation not offered | ImageParameterValidator.cs |
| E5054 | The model does not stream partial images. | Partial images on a model without them | ImageParameterValidator.cs |
| E5055 | Too many partial images. | Over MaxPartialImages | ImageParameterValidator.cs |
| E5056 | Partial images are streamed for one image only; ask for 1 image or no partial images. | Partial images with count > 1 | ImageParameterValidator.cs |
| E5057 | The model cannot use web search. | Web grounding not supported | ImageParameterValidator.cs |
| E5058 | The size is not a size. | Width or height <= 0 | ImageParameterValidator.cs |
| E5059 | Both sides must be a multiple of the model's step. | Not a multiple of SizeMultiple | ImageParameterValidator.cs |
| E5060 | A side is shorter than the model accepts. | Below MinSide | ImageParameterValidator.cs |
| E5061 | A side is longer than the model accepts. | Above MaxSide | ImageParameterValidator.cs |
| E5062 | The image has fewer pixels than the model accepts. | Below MinPixels | ImageParameterValidator.cs |
| E5063 | The image has more pixels than the model accepts. | Above MaxPixels | ImageParameterValidator.cs |
| E5064 | The aspect ratio is wider than the model accepts. | Above MaxAspectRatio | ImageParameterValidator.cs |
| E5100 | The file is larger than 100 MB. | Upload over the 100 MB limit (413) | Controllers/FileTransfer.cs, Services/Files/FileService.cs |
| E5101 | This file type is not supported. | Upload of a file type that is not accepted | Services/Files/FileService.cs |
| E5102 | The upload does not hold one file. | Upload that is not a multipart form with a file | Controllers/FileTransfer.cs |
| E5104 | Files cannot be stored for this id. | The chat or assistant id cannot name a blob container | Services/Files/FileService.cs |
| E5105 | The file's category is not valid. | File uploaded to an assistant with a category that is not always loaded or selective loaded | Services/AssistantService.cs |
| E5110 | The file could not be read. | Conversion failed without a more specific code | Services/Files/FileConversionService.cs |
| E5111 | The image could not be read. | The image cannot be decoded | Services/Files/Converters/ImageConverter.cs |
| E5112 | The PDF is password protected. | Encrypted PDF | Services/Files/Converters/PdfConverter.cs |
| E5113 | The file is not a valid PDF. | The PDF cannot be opened | Services/Files/Converters/PdfConverter.cs |
| E5114 | The Word document could not be opened. | The docx cannot be opened | Services/Files/Converters/DocxConverter.cs |
| E5115 | The Word document has no content. | Docx without a document body | Services/Files/Converters/DocxConverter.cs |
| E5116 | The PowerPoint presentation could not be opened. | The pptx cannot be opened | Services/Files/Converters/PptxConverter.cs |
| E5117 | The Excel workbook could not be opened. | The xlsx cannot be opened | Services/Files/Converters/XlsxConverter.cs |
| E5130 | The message is not waiting for files. | A file is uploaded to, or a send names, a message that does not exist or is already sent | Services/Files/FileService.cs, Controllers/ChatsController.cs |
| E5131 | Preview is not available for this file. | Switched off in stage 1. Original requested for a file stored in Cosmos that is neither only text nor one image | Services/Files/FileService.cs |

## E5500–E5799 Files in the web client

Paths are relative to ChatUiT.Client/src.

| Code | Message | Cause | Where |
|---|---|---|---|
| E5500 | File type not supported | Attached file fails the type check | components/chat/ChatInput.tsx, components/assistants/KnowledgeFileList.tsx |
| E5580 | The file is larger than 100 MB. | Attached file over the size limit, refused before upload | components/chat/ChatInput.tsx, components/assistants/KnowledgeFileList.tsx |
| E5581 | The file could not be uploaded. | Upload failed with no coded error | services/chatService.ts, components/assistants/AssistantForm.tsx |
| E5582 | The file could not be loaded. | Switched off in stage 1. The original could not be fetched for a preview, with no coded error | components/chat/OriginalFilePreviewModal.tsx |

## E5800–E5999 File import in the Office add-in

Paths are relative to ChatUiT.Office/src. The composer shows these as "<file name>: <message> (E58xx)".

| Code | Message | Cause | Where |
|---|---|---|---|
| E5801 | This file type is not supported. | Attached file type is not in the supported list | chat/ui/Composer.tsx, chat/files/readFile.ts |
| E5802 | At most {n} files can go with one message. | More than MAX_FILES attached | chat/ui/Composer.tsx |
| E5803 | A new version of ChatUiT is available. Reopen the pane and try again. | Reader chunk failed to load after a deploy | chat/files/readFile.ts |
| E5804 | The file could not be read. | Import failure with no specific code | chat/ui/Composer.tsx, chat/files/readFile.ts |
| E5810 | The PDF file could not be read. | pdf.js failed (corrupt, encrypted and so on), plus detail | chat/files/readFile.ts |
| E5820 | The Word file could not be read. | DOCX unzip or parse failed, plus detail | chat/files/readFile.ts |
| E5821 | The Word file has no document content. | DOCX lacks word/document.xml or its rels | chat/files/import/docxImportProcessor.ts |
| E5822 | The Word file has no document body. | DOCX document.xml has no body element | chat/files/import/docxImportProcessor.ts |
| E5830 | The PowerPoint file could not be read. | PPTX unzip or parse failed, plus detail | chat/files/readFile.ts |
| E5840 | The Excel file could not be read. | ExcelJS failed, plus detail | chat/files/readFile.ts |
| E5841 | The images in this Excel file cannot be read. | ExcelJS cannot extract the workbook's images | chat/files/import/xlsxImportProcessor.ts |
| E5850 | The text file could not be read. | Text file read failed, plus detail | chat/files/readFile.ts |
| E5860 | The image could not be read. | Image import failed, plus detail | chat/files/readFile.ts |
| E5870 | The file could not be read because drawing is unavailable in this pane. | No 2D canvas context | chat/files/import/pdfImportProcessor.ts, chat/files/import/processingShared.ts |
| E5871 | An image in the file could not be decoded. | Browser could not decode an image | chat/files/import/processingShared.ts |
| E5872 | An image in the file could not be loaded. | FileReader failed on an image blob, plus detail | chat/files/import/processingShared.ts |
| E5873 | An image in the file could not be converted. | canvas.toBlob returned null | chat/files/import/processingShared.ts |
