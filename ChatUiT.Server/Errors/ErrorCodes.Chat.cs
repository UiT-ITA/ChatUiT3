namespace ChatUiT.Server.Errors;

/// <summary>E2000–E2099: chat generation and the Responses API.</summary>
public static partial class ErrorCodes
{
    private const string GenerationFailedText = "The response could not be completed because an error occurred while generating it.";

    // Chat generation
    public static readonly ErrorCode GenerationStale = new("E2000", GenerationFailedText);
    public static readonly ErrorCode GenerationFailedBeforeRun = new("E2001", GenerationFailedText);
    public static readonly ErrorCode GenerationFailed = new("E2002", GenerationFailedText);
    public static readonly ErrorCode ChatNeedsRedAssistant = new("E2003", "This chat allows red data, so it can only use red assistants.");
    public static readonly ErrorCode AssistantRequired = new("E2004", "Assistant is required.");
    public static readonly ErrorCode ModelUnavailable = new("E2005", "Selected model is unavailable or misconfigured.");
    public static readonly ErrorCode ProviderNotSupported = new("E2006", "The selected provider is not supported.");
    public static readonly ErrorCode AssistantInvalid = new("E2007", "Selected assistant is invalid.");
    public static readonly ErrorCode AssistantHasNoModel = new("E2008", "Selected assistant has no model configured.");
    public static readonly ErrorCode AssistantAccessDenied = new("E2009", "You do not have access to the assistant.");
    public static readonly ErrorCode SharedAssistantRemoved = new("E2010", "The shared assistant was removed from your list: it uses tools you are not allowed to use.");

    // Responses API: requests and runs
    public static readonly ErrorCode ResponsesListModelsFailed = new("E2020", "The server could not list the models.");
    public static readonly ErrorCode ResponsesGetModelFailed = new("E2021", "The server could not read the model.");
    public static readonly ErrorCode ResponsesPrepareFailed = new("E2022", "The server could not handle the request.");
    public static readonly ErrorCode ResponsesRunFailed = new("E2023", GenerationFailedText);
    public static readonly ErrorCode ResponsesStreamFailed = new("E2024", "The response stream failed.");
    public static readonly ErrorCode ResponsesModelNotFound = new("E2025", "The model does not exist or you do not have access to it.");
    public static readonly ErrorCode ResponsesInvalidJson = new("E2026", "The request body is not valid JSON.");
    public static readonly ErrorCode ResponsesBodyNotObject = new("E2027", "The request body must be a JSON object.");
    public static readonly ErrorCode ResponsesModelRequired = new("E2028", "model is required.");

    // Responses API: request validation
    public static readonly ErrorCode ResponsesStoreNotSupported = new("E2030", "store must be false or omitted: nothing is stored.");
    public static readonly ErrorCode ResponsesToolChoiceNotSupported = new("E2031", "tool_choice must be \"auto\".");
    public static readonly ErrorCode ResponsesUnsupportedParameter = new("E2032", "Unsupported parameter.");
    public static readonly ErrorCode ResponsesParameterOnlyForModels = new("E2033", "The parameter is only accepted for raw models; an agent uses its own settings.");
    public static readonly ErrorCode ResponsesTemperatureOutOfRange = new("E2034", "temperature must be between 0 and 2.");
    public static readonly ErrorCode ResponsesMaxOutputTokensInvalid = new("E2035", "max_output_tokens must be positive.");
    public static readonly ErrorCode ResponsesEffortNotSupported = new("E2036", "Unsupported reasoning.effort.");
    public static readonly ErrorCode ResponsesModelCannotCallFunctions = new("E2037", "This model cannot call functions.");
    public static readonly ErrorCode ResponsesToolTypeNotSupported = new("E2038", "Only tools of type \"function\" are supported.");
    public static readonly ErrorCode ResponsesStrictToolsNotSupported = new("E2039", "Strict function tools are not supported.");
    public static readonly ErrorCode ResponsesTooManyTools = new("E2040", "Too many tools.");
    public static readonly ErrorCode ResponsesToolInvalid = new("E2041", "A tool declaration is not valid.");
    public static readonly ErrorCode ResponsesInputInvalid = new("E2042", "input must be a string or an array of items.");
    public static readonly ErrorCode ResponsesInputItemNotObject = new("E2043", "An input item must be an object.");
    public static readonly ErrorCode ResponsesInputItemTypeNotSupported = new("E2044", "The input item type is not supported.");
    public static readonly ErrorCode ResponsesInputItemInvalid = new("E2045", "An input item is not valid.");
    public static readonly ErrorCode ResponsesFunctionCallIncomplete = new("E2046", "function_call needs call_id and name.");
    public static readonly ErrorCode ResponsesCallIdRepeated = new("E2047", "A call_id appears twice.");
    public static readonly ErrorCode ResponsesOutputWithoutCall = new("E2048", "No function_call with the call_id precedes the output.");
    public static readonly ErrorCode ResponsesCallHasTwoOutputs = new("E2049", "A call_id has two outputs.");
    public static readonly ErrorCode ResponsesApprovalIdInvalid = new("E2050", "The approval request id is not valid.");
    public static readonly ErrorCode ResponsesApprovalOtherModel = new("E2051", "The approval request belongs to another model.");
    public static readonly ErrorCode ResponsesApprovalResponseWithoutRequest = new("E2052", "No mcp_approval_request with the id precedes the response.");
    public static readonly ErrorCode ResponsesApprovalAnsweredTwice = new("E2053", "The approval request has two responses.");
    public static readonly ErrorCode ResponsesMcpCallIncomplete = new("E2054", "mcp_call needs id and name.");
    public static readonly ErrorCode ResponsesCallWithoutOutput = new("E2055", "No function_call_output follows the call.");
    public static readonly ErrorCode ResponsesCallResultMissing = new("E2056", "A call answered in an earlier response has no result in the input.");
    public static readonly ErrorCode ResponsesApprovalWithoutResponse = new("E2057", "No mcp_approval_response answers the approval request.");
    public static readonly ErrorCode ResponsesAnswersNotForQuestions = new("E2058", "chatuit_answers only answers questions.");
    public static readonly ErrorCode ResponsesEditNotAllowed = new("E2059", "chatuit_edited_arguments is only accepted when the preview allows editing.");
    public static readonly ErrorCode ResponsesEditedArgumentsNotJson = new("E2060", "chatuit_edited_arguments is not valid JSON.");
    public static readonly ErrorCode ResponsesEditedArgumentsNotObject = new("E2061", "chatuit_edited_arguments must be a JSON object.");
    public static readonly ErrorCode ResponsesEditedArgumentsForQuestion = new("E2062", "chatuit_edited_arguments does not answer questions.");
    public static readonly ErrorCode ResponsesAnswersMissing = new("E2063", "Questions are answered with chatuit_answers.");
    public static readonly ErrorCode ResponsesAnswersInvalid = new("E2064", "The answers do not fit the questions.");
    public static readonly ErrorCode ResponsesRoleNotSupported = new("E2065", "The message role is not supported.");
    public static readonly ErrorCode ResponsesToolOutputInvalid = new("E2066", "output must be a string or an array of input_text and input_image parts.");
    public static readonly ErrorCode ResponsesTooManyOutputImages = new("E2067", "Too many images in a tool output.");
    public static readonly ErrorCode ResponsesOutputPartNotSupported = new("E2068", "The output part type is not supported.");
    public static readonly ErrorCode ResponsesImageUrlInvalid = new("E2069", "image_url must be a base64 data URL of a png, jpeg, gif or webp image.");
    public static readonly ErrorCode ResponsesImageTooLarge = new("E2070", "The image is too large.");
    public static readonly ErrorCode ResponsesContentInvalid = new("E2071", "content must be a string or an array of parts.");
    public static readonly ErrorCode ResponsesTooManyFiles = new("E2072", "Too many files in a message.");
    public static readonly ErrorCode ResponsesContentTypeNotSupported = new("E2073", "The content type is not supported.");
    public static readonly ErrorCode ResponsesFileNameMissing = new("E2074", "input_file needs a filename.");
    public static readonly ErrorCode ResponsesFileChunksMissing = new("E2075", "input_file needs chunks: an array of input_text and input_image parts.");
    public static readonly ErrorCode ResponsesChunkTypeNotSupported = new("E2076", "The chunk type is not supported.");
}
