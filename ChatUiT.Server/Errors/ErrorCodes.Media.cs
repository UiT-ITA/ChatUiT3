namespace ChatUiT.Server.Errors;

/// <summary>E5000–E5499: files and media generation.</summary>
public static partial class ErrorCodes
{
    // Image generation runs
    public static readonly ErrorCode ImageGenerationFailed = new("E5000", "The generation failed because of an error.");
    public static readonly ErrorCode ImageGenerationTimedOut = new("E5001", "The model did not finish in time.");
    public static readonly ErrorCode ImageContentFiltered = new("E5002", "The content filter blocked the request.");
    public static readonly ErrorCode ImageServiceBusy = new("E5003", "The image service is busy. Try again in a minute.");
    public static readonly ErrorCode ImageServiceRejected = new("E5004", "The image service rejected the request.");
    public static readonly ErrorCode ImageServiceFailed = new("E5005", "The image service failed.");

    // Image generation requests
    public static readonly ErrorCode ImagePromptRequired = new("E5010", "A prompt is required.");
    public static readonly ErrorCode ImageModelNotFound = new("E5011", "The image model does not exist or is not available to you.");
    public static readonly ErrorCode PromptRefinementUnavailable = new("E5012", "No default model is set up to refine prompts.");
    public static readonly ErrorCode PromptTooLongToRefine = new("E5013", "The prompt is too long to refine.");
    public static readonly ErrorCode PromptRefinementFailed = new("E5014", "The model could not refine the prompt.");
    public static readonly ErrorCode PromptRefinementEmpty = new("E5015", "The model returned no prompt.");
    public static readonly ErrorCode ImageEndpointMissing = new("E5016", "The image model's endpoint is missing or not supported.");
    public static readonly ErrorCode ImagesTooLarge = new("E5017", "The images are larger than the model accepts.");
    public static readonly ErrorCode ImageRequestNotJson = new("E5018", "The request is not valid JSON.");
    public static readonly ErrorCode ImageRequestEmpty = new("E5019", "The request is empty.");
    public static readonly ErrorCode NotAnImage = new("E5020", "The file is not a PNG, JPEG or WebP image.");

    // Image parameters the model does not support
    public static readonly ErrorCode ImagePromptTooLong = new("E5030", "The prompt is longer than the model accepts.");
    public static readonly ErrorCode ImageOverlayNeedsInput = new("E5031", "A mask or markup needs an input image.");
    public static readonly ErrorCode ImageModelCannotEdit = new("E5032", "The model cannot edit images.");
    public static readonly ErrorCode TooManyInputImages = new("E5033", "Too many input images.");
    public static readonly ErrorCode ImageInputFormatNotAccepted = new("E5034", "The model does not accept the input image format.");
    public static readonly ErrorCode ImageInputTooLarge = new("E5035", "An input image is larger than the model accepts.");
    public static readonly ErrorCode ImageMaskNotSupported = new("E5036", "The model does not accept a mask.");
    public static readonly ErrorCode ImageMarkupNotSupported = new("E5037", "The model does not accept markup.");
    public static readonly ErrorCode ImageMaskAndMarkup = new("E5038", "A mask and markup cannot be used together.");
    public static readonly ErrorCode ImageOverlayNotPng = new("E5039", "A mask or markup must be a PNG.");
    public static readonly ErrorCode ImageModerationOnlyForGeneration = new("E5040", "A moderation level applies to generations only.");
    public static readonly ErrorCode ImageEditTakesOnlyPrompt = new("E5041", "The model takes only the prompt and the images when editing.");
    public static readonly ErrorCode ImageSizeNotOffered = new("E5042", "The model does not offer the size.");
    public static readonly ErrorCode ImageSizeRequired = new("E5043", "The model needs a size.");
    public static readonly ErrorCode ImageAutoAspectNotSupported = new("E5044", "The model cannot pick the aspect ratio.");
    public static readonly ErrorCode ImageQualityNotOffered = new("E5045", "The model does not offer the quality.");
    public static readonly ErrorCode ImageCountOutOfRange = new("E5046", "Too many images per request.");
    public static readonly ErrorCode ImageOutputFormatNotOffered = new("E5047", "The model does not return the format.");
    public static readonly ErrorCode ImageCompressionNotSupported = new("E5048", "The model does not take a compression level.");
    public static readonly ErrorCode ImageCompressionNeedsJpegOrWebp = new("E5049", "A compression level applies to JPEG and WebP only.");
    public static readonly ErrorCode ImageCompressionOutOfRange = new("E5050", "Compression is out of range.");
    public static readonly ErrorCode ImageBackgroundNotOffered = new("E5051", "The model does not offer the background.");
    public static readonly ErrorCode ImageTransparentNeedsPngOrWebp = new("E5052", "A transparent background needs PNG or WebP.");
    public static readonly ErrorCode ImageModerationNotOffered = new("E5053", "The model does not offer the moderation level.");
    public static readonly ErrorCode ImagePartialNotSupported = new("E5054", "The model does not stream partial images.");
    public static readonly ErrorCode ImagePartialOutOfRange = new("E5055", "Too many partial images.");
    public static readonly ErrorCode ImagePartialNeedsOneImage = new("E5056", "Partial images are streamed for one image only; ask for 1 image or no partial images.");
    public static readonly ErrorCode ImageWebSearchNotSupported = new("E5057", "The model cannot use web search.");
    public static readonly ErrorCode ImageSizeInvalid = new("E5058", "The size is not a size.");
    public static readonly ErrorCode ImageSizeNotMultiple = new("E5059", "Both sides must be a multiple of the model's step.");
    public static readonly ErrorCode ImageSideTooShort = new("E5060", "A side is shorter than the model accepts.");
    public static readonly ErrorCode ImageSideTooLong = new("E5061", "A side is longer than the model accepts.");
    public static readonly ErrorCode ImageTooFewPixels = new("E5062", "The image has fewer pixels than the model accepts.");
    public static readonly ErrorCode ImageTooManyPixels = new("E5063", "The image has more pixels than the model accepts.");
    public static readonly ErrorCode ImageAspectRatioTooWide = new("E5064", "The aspect ratio is wider than the model accepts.");
}
