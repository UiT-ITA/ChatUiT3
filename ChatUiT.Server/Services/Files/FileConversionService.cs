using ChatUiT.Server.Errors;
using ChatUiT.Server.Services.Files.Converters;

namespace ChatUiT.Server.Services.Files;

/// <summary>
/// Converts uploaded files to text and images. At most one conversion per CPU core runs at a
/// time. The rest wait their turn.
/// </summary>
public sealed class FileConversionService
{
    private readonly SemaphoreSlim _slots = new(Environment.ProcessorCount, Environment.ProcessorCount);

    /// <param name="content">The whole file, seekable.</param>
    /// <exception cref="FileConversionException">The file cannot be converted.</exception>
    public async Task<ConvertedFile> ConvertAsync(FileKind kind, Stream content, CancellationToken cancellationToken)
    {
        await _slots.WaitAsync(cancellationToken);
        try
        {
            return await Task.Run(() => Convert(kind, content, cancellationToken), cancellationToken);
        }
        finally
        {
            _slots.Release();
        }
    }

    private static ConvertedFile Convert(FileKind kind, Stream content, CancellationToken cancellationToken)
    {
        try
        {
            var parts = kind switch
            {
                FileKind.Image => ImageConverter.Convert(content),
                FileKind.Text => TextConverter.Convert(content, "plain"),
                FileKind.Markdown => TextConverter.Convert(content, "markdown"),
                FileKind.Pdf => PdfConverter.Convert(content, cancellationToken),
                FileKind.Docx => DocxConverter.Convert(content),
                FileKind.Pptx => PptxConverter.Convert(content),
                FileKind.Xlsx => XlsxConverter.Convert(content),
                _ => throw new FileConversionException(ErrorCodes.FileTypeNotSupported)
            };
            return new ConvertedFile(ConvertedParts.Clean(parts));
        }
        catch (Exception ex) when (ex is not FileConversionException and not OperationCanceledException)
        {
            throw new FileConversionException(ErrorCodes.FileConversionFailed, ex);
        }
    }
}
