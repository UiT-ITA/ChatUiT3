namespace ChatUiT.Server.Errors;

/// <summary>E5100–E5199: uploaded chat and assistant files.</summary>
public static partial class ErrorCodes
{
    // Upload
    public static readonly ErrorCode FileTooLarge = new("E5100", "The file is larger than 100 MB.");
    public static readonly ErrorCode FileTypeNotSupported = new("E5101", "This file type is not supported.");
    public static readonly ErrorCode FileUploadInvalid = new("E5102", "The upload does not hold one file.");
    public static readonly ErrorCode FileOwnerIdInvalid = new("E5104", "Files cannot be stored for this id.");
    public static readonly ErrorCode AssistantFileCategoryInvalid = new("E5105", "The file's category is not valid.");

    // Conversion
    public static readonly ErrorCode FileConversionFailed = new("E5110", "The file could not be read.");
    public static readonly ErrorCode ImageUnreadable = new("E5111", "The image could not be read.");
    public static readonly ErrorCode PdfPasswordProtected = new("E5112", "The PDF is password protected.");
    public static readonly ErrorCode PdfInvalid = new("E5113", "The file is not a valid PDF.");
    public static readonly ErrorCode DocxOpenFailed = new("E5114", "The Word document could not be opened.");
    public static readonly ErrorCode DocxContentMissing = new("E5115", "The Word document has no content.");
    public static readonly ErrorCode PptxOpenFailed = new("E5116", "The PowerPoint presentation could not be opened.");
    public static readonly ErrorCode XlsxOpenFailed = new("E5117", "The Excel workbook could not be opened.");

    // Attaching and reading
    public static readonly ErrorCode MessageNotWaitingForFiles = new("E5130", "The message is not waiting for files.");
    public static readonly ErrorCode FilePreviewNotAvailable = new("E5131", "Preview is not available for this file.");
}
