using ChatUiT.Server.Errors;

namespace ChatUiT.Server.Services.Files;

/// <summary>A file that cannot be converted. <see cref="Error"/> is shown to the user.</summary>
public sealed class FileConversionException(ErrorCode error, Exception? innerException = null) : Exception(error.Message, innerException)
{
    public ErrorCode Error { get; } = error;
}
