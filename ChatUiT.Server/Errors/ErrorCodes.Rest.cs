namespace ChatUiT.Server.Errors;

/// <summary>E4000–E4999: REST and admin endpoints.</summary>
public static partial class ErrorCodes
{
    // Any endpoint
    public static readonly ErrorCode InternalServerError = new("E4000", "Internal server error.");
    public static readonly ErrorCode RequestInvalid = new("E4001", "The request is not valid.");
    public static readonly ErrorCode TrainingRequired = new("E4002", "The mandatory training must be completed first.");

    // Chats
    public static readonly ErrorCode ChatNotFound = new("E4010", "Chat not found.");
    public static readonly ErrorCode ChatFileNotFound = new("E4011", "File not found.");
    public static readonly ErrorCode RedChatNeedsRedAssistant = new("E4012", "Red data requires a red assistant.");
    public static readonly ErrorCode ClientToolsInvalid = new("E4013", "The client tools are not valid.");
    public static readonly ErrorCode ToolCallResponseInvalid = new("E4014", "The answer does not fit the tool call.");
    public static readonly ErrorCode ToolCallNotWaiting = new("E4015", "The tool call no longer waits for an answer.");
    public static readonly ErrorCode ChatNameEmpty = new("E4016", "Chat name cannot be empty.");
    public static readonly ErrorCode ChatNameTooLong = new("E4017", "Chat name is too long.");
    public static readonly ErrorCode RedCannotBeSwitchedOff = new("E4018", "Red data cannot be switched off once allowed.");

    // Assistants
    public static readonly ErrorCode AssistantFileNotFound = new("E4030", "File not found.");
    public static readonly ErrorCode AssistantToolsNotAllowed = new("E4031", "The assistant uses tools you are not allowed to use.");
    public static readonly ErrorCode AssistantKnowledgeSourcesNotAllowed = new("E4032", "The assistant uses knowledge sources you are not allowed to use.");
    public static readonly ErrorCode AlwaysLoadedFilesTooLarge = new("E4033", "The always loaded files use more tokens than the model allows.");
    public static readonly ErrorCode OnDemandFileNeedsDescription = new("E4034", "An on-demand file needs a description.");
    public static readonly ErrorCode AssistantCannotBeDefault = new("E4035", "This assistant cannot be set as your default.");
    public static readonly ErrorCode SharedAssistantToolsNotAllowed = new("E4036", "The shared assistant uses tools you are not allowed to use.");
    public static readonly ErrorCode AssistantNotFound = new("E4037", "Assistant not found.");

    // Admin: assistants, tools, agents and settings
    public static readonly ErrorCode AdminToolsInvalid = new("E4100", "The assistant names tools that do not exist.");
    public static readonly ErrorCode AdminKnowledgeSourcesUnknown = new("E4101", "The assistant names knowledge sources that do not exist.");
    public static readonly ErrorCode GroupIdsInvalid = new("E4102", "Group ids must be GUIDs.");
    public static readonly ErrorCode AdminAssistantModelInvalid = new("E4103", "Invalid model ID.");
    public static readonly ErrorCode RouteIdMismatch = new("E4104", "Route id does not match request body id.");
    public static readonly ErrorCode InternalAgentNotFound = new("E4105", "Internal agent not found.");
    public static readonly ErrorCode AgentModelUnknown = new("E4106", "Choose the model the agent runs on.");
    public static readonly ErrorCode AgentModelCannotCallFunctions = new("E4107", "The model does not support function calling, which an agent needs.");
    public static readonly ErrorCode AgentNotExposable = new("E4108", "The agent cannot be exposed in the API.");
    public static readonly ErrorCode ToolNotFound = new("E4109", "Tool not found.");
    public static readonly ErrorCode SettingsModelUnknown = new("E4110", "Unknown model id.");
    public static readonly ErrorCode SettingsAssistantUnknown = new("E4111", "Unknown system assistant id.");

    // Admin: endpoints
    public static readonly ErrorCode EndpointNotFound = new("E4112", "Endpoint not found.");
    public static readonly ErrorCode EndpointTypeInvalid = new("E4113", "Invalid endpoint type.");
    public static readonly ErrorCode EndpointAuthMethodInvalid = new("E4114", "Invalid auth method.");
    public static readonly ErrorCode EndpointManagedIdentityNotSupported = new("E4115", "The endpoint does not accept managed identity. Use an API key.");
    public static readonly ErrorCode EndpointApiKeyRequired = new("E4116", "An API key is required.");

    // Admin: models
    public static readonly ErrorCode ModelNotFound = new("E4117", "Model not found.");
    public static readonly ErrorCode ModelTokenSchemeUnknown = new("E4118", "Unknown token counting scheme.");
    public static readonly ErrorCode ModelApiProtocolUnknown = new("E4119", "Unknown API protocol.");
    public static readonly ErrorCode ModelClassificationUnknown = new("E4120", "Unknown data classification.");
    public static readonly ErrorCode ModelImageApiUnknown = new("E4121", "Unknown image API.");
    public static readonly ErrorCode ModelImagesPerRequestTooLow = new("E4122", "The model must make at least 1 image per request.");
    public static readonly ErrorCode ModelOutputFormatMissing = new("E4123", "The model must return at least one format.");
    public static readonly ErrorCode ModelSizeMissing = new("E4124", "The model must offer a size: presets, auto size or custom sizes.");
    public static readonly ErrorCode ModelSizePresetInvalid = new("E4125", "Every size preset needs a width and height above 0.");
    public static readonly ErrorCode ModelPartialImagesNegative = new("E4126", "Partial images cannot be negative.");
    public static readonly ErrorCode ModelEditingInputsMissing = new("E4127", "An editing model must take at least 1 input image and one input format.");
    public static readonly ErrorCode ModelApiIdInvalid = new("E4128", "The model id is its id in the API, so it must match ^[a-z0-9][a-z0-9._-]{0,63}$.");
    public static readonly ErrorCode ModelApiIdIsAgentId = new("E4129", "The model id is an internal agent's id in the API.");
    public static readonly ErrorCode ModelApiIdTaken = new("E4130", "Another model is already exposed in the API with this model id.");
    public static readonly ErrorCode ModelTypeMismatch = new("E4131", "The model is of another type.");

    // Admin: model test
    public static readonly ErrorCode ModelTestEndpointMissing = new("E4140", "The model's endpoint does not exist.");
    public static readonly ErrorCode ModelTestProviderMissing = new("E4141", "No AI provider is registered for the endpoint type.");
    public static readonly ErrorCode ModelTestTypeNotSupported = new("E4142", "Models of this type cannot be tested yet.");
    public static readonly ErrorCode ModelTestFailed = new("E4143", "The model test failed.");
    public static readonly ErrorCode ModelTestNoText = new("E4144", "The model returned no text.");
    public static readonly ErrorCode ModelTestNoImage = new("E4145", "The model returned no image.");

    // Training, Insights and telemetry
    public static readonly ErrorCode TrainingCourseChanged = new("E4200", "The course has a new version. Reload the course and take the test again.");
    public static readonly ErrorCode TrainingQuestionUnknown = new("E4201", "Unknown question.");
    public static readonly ErrorCode InsightsRangeUnknown = new("E4210", "Unknown range.");
    public static readonly ErrorCode InsightsNotConfigured = new("E4211", "Insights are not configured.");
    public static readonly ErrorCode InsightsNoAccess = new("E4212", "The server has no access to the Insights data.");
    public static readonly ErrorCode InsightsQueryFailed = new("E4213", "The Insights query failed.");
    public static readonly ErrorCode TelemetryBatchTooLarge = new("E4220", "Too many records in the batch.");
}
