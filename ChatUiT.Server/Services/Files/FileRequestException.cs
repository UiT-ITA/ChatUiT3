using ChatUiT.Server.Errors;

namespace ChatUiT.Server.Services.Files;

/// <summary>A file request that is refused. <see cref="Error"/> is shown to the user.</summary>
public sealed class FileRequestException(ErrorCode error, int statusCode = StatusCodes.Status400BadRequest, Exception? innerException = null)
    : Exception(error.Message, innerException)
{
    public ErrorCode Error { get; } = error;

    public int StatusCode { get; } = statusCode;
}
