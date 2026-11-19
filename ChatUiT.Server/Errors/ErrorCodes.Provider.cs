namespace ChatUiT.Server.Errors;

/// <summary>AI provider failures, E2100–E2299.</summary>
public static partial class ErrorCodes
{
    public static readonly ErrorCode ProviderTooManyImages = new("E2100", "The conversation has too many images for the model.");
    public static readonly ErrorCode ProviderImageUnreadable = new("E2101", "The model could not read one of the images. It may be damaged, too large or in an unsupported format.");
    public static readonly ErrorCode ProviderContextTooLong = new("E2102", "The conversation is too long for the model.");
    public static readonly ErrorCode ProviderOutputLimitReached = new("E2103", "The answer reached the model's length limit before it was finished.");
    public static readonly ErrorCode ProviderInputFiltered = new("E2104", "The message was blocked by the content filter of the model provider.");
    public static readonly ErrorCode ProviderOutputFiltered = new("E2105", "The answer was stopped by the content filter of the model provider.");
    public static readonly ErrorCode ProviderRefused = new("E2106", "The model declined to answer.");
    public static readonly ErrorCode ProviderRateLimited = new("E2107", "The model is receiving too many requests. Try again in a moment.");
    public static readonly ErrorCode ProviderQuotaExhausted = new("E2108", "The usage quota for the model is used up.");
    public static readonly ErrorCode ProviderAuthFailed = new("E2109", "The server is not allowed to use the model. Contact an administrator.");
    public static readonly ErrorCode ProviderModelNotFound = new("E2110", "The model was not found at the provider. Contact an administrator.");
    public static readonly ErrorCode ProviderRequestTooLarge = new("E2111", "The request is too large for the model.");
    public static readonly ErrorCode ProviderInvalidTool = new("E2112", "The model could not accept the definition of one of the tools.");
    public static readonly ErrorCode ProviderUnavailable = new("E2113", "The model is overloaded or unavailable. Try again later.");
    public static readonly ErrorCode ProviderTimeout = new("E2114", "The model took too long to respond.");
    public static readonly ErrorCode ProviderConnectionFailed = new("E2115", "The server could not connect to the model.");
    public static readonly ErrorCode ProviderBadRequest = new("E2198", "The model provider rejected the request.");
    public static readonly ErrorCode ProviderFailed = new("E2199", "The model provider failed to complete the request.");
}
