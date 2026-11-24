using ChatUiT.Server.Errors;
using ChatUiT.Server.Services.Files;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;

namespace ChatUiT.Server.Controllers;

/// <summary>The file of an upload request, with the form fields sent before it.</summary>
public sealed record UploadedFile(string FileName, string? ContentType, IReadOnlyDictionary<string, string> Fields);

/// <summary>Reads one uploaded file from a multipart request as a stream, and writes a file's original to a response.</summary>
public static class FileTransfer
{
    /// <summary>Room for the multipart boundaries and headers around the file.</summary>
    private const long FormOverheadBytes = 1024 * 1024;

    /// <summary>
    /// Passes the request's file to <paramref name="upload"/> as it arrives, without buffering it.
    /// The body limit is the file limit, so a larger file is refused.
    /// </summary>
    /// <exception cref="FileRequestException">The request is not a multipart form with one file, or the file is too large.</exception>
    public static async Task<T> ReadFileAsync<T>(HttpRequest request, Func<UploadedFile, Stream, Task<T>> upload, CancellationToken cancellationToken)
    {
        var limit = FileKinds.MaxFileBytes + FormOverheadBytes;
        if (request.ContentLength > limit)
        {
            throw new FileRequestException(ErrorCodes.FileTooLarge, StatusCodes.Status413PayloadTooLarge);
        }

        if (request.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } bodySize)
        {
            bodySize.MaxRequestBodySize = limit;
        }

        if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var mediaType) ||
            !mediaType.MediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase) ||
            HeaderUtilities.RemoveQuotes(mediaType.Boundary).Value is not { Length: > 0 } boundary)
        {
            throw new FileRequestException(ErrorCodes.FileUploadInvalid);
        }

        try
        {
            var reader = new MultipartReader(boundary, request.Body);
            var fields = new Dictionary<string, string>();
            while (await reader.ReadNextSectionAsync(cancellationToken) is { } section)
            {
                if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition))
                {
                    continue;
                }

                if (disposition.IsFileDisposition() &&
                    (disposition.FileNameStar.Value ?? HeaderUtilities.RemoveQuotes(disposition.FileName).Value) is { Length: > 0 } fileName)
                {
                    return await upload(new UploadedFile(fileName, section.ContentType, fields), section.Body);
                }

                if (disposition.IsFormDisposition() && HeaderUtilities.RemoveQuotes(disposition.Name).Value is { Length: > 0 } name)
                {
                    using var text = new StreamReader(section.Body);
                    fields[name] = await text.ReadToEndAsync(cancellationToken);
                }
            }
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            throw new FileRequestException(ErrorCodes.FileTooLarge, StatusCodes.Status413PayloadTooLarge, ex);
        }
        catch (InvalidDataException ex)
        {
            throw new FileRequestException(ErrorCodes.FileUploadInvalid, innerException: ex);
        }

        throw new FileRequestException(ErrorCodes.FileUploadInvalid);
    }

    /// <summary>Streams the original to the response, shown inline or saved as a file. Switched off in stage 1: nothing calls this.</summary>
    public static async Task<IActionResult> WriteAsync(HttpResponse response, FileDownload file, bool download, CancellationToken cancellationToken)
    {
        var disposition = new ContentDispositionHeaderValue(download ? "attachment" : "inline");
        disposition.SetHttpFileName(file.FileName);

        response.ContentType = file.ContentType;
        response.ContentLength = file.Length;
        response.Headers.ContentDisposition = disposition.ToString();
        response.Headers.XContentTypeOptions = "nosniff";
        response.Headers.CacheControl = "private, no-store";

        await file.WriteToAsync(response.Body, cancellationToken);
        return new EmptyResult();
    }

    public static ObjectResult Error(FileRequestException exception)
        => ApiErrors.Result(exception.StatusCode, exception.Error);
}
