using System.Collections.Generic;
using System.Linq;
using ChatUiT.Server.Errors;

namespace ChatUiT.Server.Services.AiProviders.Images;

using ChatUiT.Server.Models;

/// <summary>
/// Checks an image request against what the model supports. A request that asks for
/// something the model cannot do is refused with the reasons, never adjusted.
/// </summary>
public static class ImageParameterValidator
{
    private const int MaxCompression = 100;

    /// <summary>The problems with the request, each with its error code. Empty when the model can run it.</summary>
    public static IReadOnlyList<ErrorCode> Validate(ImageModelCapabilities capabilities, ImageGenerationParameters parameters)
    {
        var problems = new List<ErrorCode>();

        if (string.IsNullOrWhiteSpace(parameters.Prompt))
        {
            problems.Add(ErrorCodes.ImagePromptRequired);
        }
        else if (capabilities.MaxPromptCharacters is { } maxPrompt && parameters.Prompt.Length > maxPrompt)
        {
            problems.Add(ErrorCodes.ImagePromptTooLong with { Message = $"The prompt is {parameters.Prompt.Length} characters; the model accepts at most {maxPrompt}." });
        }

        if (parameters.IsEdit)
        {
            ValidateEdit(capabilities, parameters, problems);
        }
        else
        {
            if (parameters.Mask != null || parameters.Markup != null)
            {
                problems.Add(ErrorCodes.ImageOverlayNeedsInput);
            }

            ValidateGenerationSettings(capabilities, parameters, problems);
        }

        return problems;
    }

    private static void ValidateEdit(ImageModelCapabilities capabilities, ImageGenerationParameters parameters, List<ErrorCode> problems)
    {
        if (capabilities.Editing is not { } editing)
        {
            problems.Add(ErrorCodes.ImageModelCannotEdit);
            return;
        }

        if (parameters.InputImages.Count > editing.MaxInputImages)
        {
            problems.Add(ErrorCodes.TooManyInputImages with { Message = $"The model accepts at most {editing.MaxInputImages} input images." });
        }

        foreach (var image in parameters.InputImages)
        {
            if (!editing.InputFormats.Contains(image.Format))
            {
                problems.Add(ErrorCodes.ImageInputFormatNotAccepted with { Message = $"{image.FileName}: the model does not accept {image.Format} input images." });
            }

            if (editing.MaxInputImageBytes is { } maxBytes && image.Content.LongLength > maxBytes)
            {
                problems.Add(ErrorCodes.ImageInputTooLarge with { Message = $"{image.FileName}: the model accepts input images of at most {maxBytes / (1024 * 1024)} MB." });
            }
        }

        if (parameters.Mask != null && !editing.SupportsMask)
        {
            problems.Add(ErrorCodes.ImageMaskNotSupported);
        }

        if (parameters.Markup != null && !editing.SupportsMarkup)
        {
            problems.Add(ErrorCodes.ImageMarkupNotSupported);
        }

        if (parameters.Mask != null && parameters.Markup != null)
        {
            problems.Add(ErrorCodes.ImageMaskAndMarkup);
        }

        foreach (var overlay in new[] { parameters.Mask, parameters.Markup }.OfType<ImageInput>())
        {
            if (overlay.Format != ImageFormat.Png)
            {
                problems.Add(ErrorCodes.ImageOverlayNotPng with { Message = $"{overlay.FileName}: a mask or markup must be a PNG." });
            }
        }

        if (parameters.Moderation != null)
        {
            problems.Add(ErrorCodes.ImageModerationOnlyForGeneration);
        }

        if (editing.AcceptsGenerationSettings)
        {
            ValidateGenerationSettings(capabilities, parameters, problems, sizeRequired: false);
            return;
        }

        if (parameters.Size != null || parameters.AutoAspectRatio || parameters.Quality != null || parameters.Count != 1
            || parameters.OutputFormat != null || parameters.Compression != null || parameters.Background != null
            || parameters.PartialImages > 0 || parameters.WebGrounding)
        {
            problems.Add(ErrorCodes.ImageEditTakesOnlyPrompt);
        }
    }

    private static void ValidateGenerationSettings(ImageModelCapabilities capabilities, ImageGenerationParameters parameters, List<ErrorCode> problems, bool sizeRequired = true)
    {
        if (parameters.Size is { } size)
        {
            if (!capabilities.SizePresets.Contains(size))
            {
                if (!capabilities.SupportsCustomSize)
                {
                    problems.Add(ErrorCodes.ImageSizeNotOffered with { Message = $"The model does not offer {size.Width}x{size.Height}." });
                }
                else
                {
                    ValidateCustomSize(capabilities, size, problems);
                }
            }
        }
        else if (sizeRequired && !capabilities.SupportsAutoSize)
        {
            problems.Add(ErrorCodes.ImageSizeRequired);
        }

        if (parameters.AutoAspectRatio && !capabilities.SupportsAutoAspectRatio)
        {
            problems.Add(ErrorCodes.ImageAutoAspectNotSupported);
        }

        if (parameters.Quality is { } quality && !capabilities.Qualities.Contains(quality))
        {
            problems.Add(ErrorCodes.ImageQualityNotOffered with { Message = $"The model does not offer {quality} quality." });
        }

        if (parameters.Count < 1 || parameters.Count > capabilities.MaxImagesPerRequest)
        {
            problems.Add(ErrorCodes.ImageCountOutOfRange with { Message = $"The model makes 1 to {capabilities.MaxImagesPerRequest} images per request." });
        }

        var format = parameters.OutputFormat ?? capabilities.OutputFormats.FirstOrDefault();
        if (parameters.OutputFormat is { } requestedFormat && !capabilities.OutputFormats.Contains(requestedFormat))
        {
            problems.Add(ErrorCodes.ImageOutputFormatNotOffered with { Message = $"The model does not return {requestedFormat} images." });
        }

        if (parameters.Compression is { } compression)
        {
            if (!capabilities.SupportsCompression)
            {
                problems.Add(ErrorCodes.ImageCompressionNotSupported);
            }
            else if (format is not (ImageFormat.Jpeg or ImageFormat.Webp))
            {
                problems.Add(ErrorCodes.ImageCompressionNeedsJpegOrWebp);
            }
            else if (compression < 0 || compression > MaxCompression)
            {
                problems.Add(ErrorCodes.ImageCompressionOutOfRange with { Message = $"Compression must be 0 to {MaxCompression}." });
            }
        }

        if (parameters.Background is { } background)
        {
            if (!capabilities.Backgrounds.Contains(background))
            {
                problems.Add(ErrorCodes.ImageBackgroundNotOffered with { Message = $"The model does not offer a {background} background." });
            }
            else if (background == ImageBackground.Transparent && format is not (ImageFormat.Png or ImageFormat.Webp))
            {
                problems.Add(ErrorCodes.ImageTransparentNeedsPngOrWebp);
            }
        }

        if (parameters.Moderation is { } moderation && !capabilities.ModerationLevels.Contains(moderation))
        {
            problems.Add(ErrorCodes.ImageModerationNotOffered with { Message = $"The model does not offer {moderation} moderation." });
        }

        if (parameters.PartialImages < 0 || parameters.PartialImages > capabilities.MaxPartialImages)
        {
            problems.Add(capabilities.MaxPartialImages == 0
                ? ErrorCodes.ImagePartialNotSupported
                : ErrorCodes.ImagePartialOutOfRange with { Message = $"The model streams 0 to {capabilities.MaxPartialImages} partial images." });
        }
        else if (parameters.PartialImages > 0 && parameters.Count > 1)
        {
            problems.Add(ErrorCodes.ImagePartialNeedsOneImage);
        }

        if (parameters.WebGrounding && !capabilities.SupportsWebGrounding)
        {
            problems.Add(ErrorCodes.ImageWebSearchNotSupported);
        }
    }

    private static void ValidateCustomSize(ImageModelCapabilities capabilities, ImageSize size, List<ErrorCode> problems)
    {
        var label = $"{size.Width}x{size.Height}";
        if (size.Width <= 0 || size.Height <= 0)
        {
            problems.Add(ErrorCodes.ImageSizeInvalid with { Message = $"{label} is not a size." });
            return;
        }

        if (capabilities.SizeMultiple is { } multiple && (size.Width % multiple != 0 || size.Height % multiple != 0))
        {
            problems.Add(ErrorCodes.ImageSizeNotMultiple with { Message = $"{label}: both sides must be a multiple of {multiple}." });
        }

        if (capabilities.MinSide is { } minSide && Math.Min(size.Width, size.Height) < minSide)
        {
            problems.Add(ErrorCodes.ImageSideTooShort with { Message = $"{label}: each side must be at least {minSide}." });
        }

        if (capabilities.MaxSide is { } maxSide && Math.Max(size.Width, size.Height) > maxSide)
        {
            problems.Add(ErrorCodes.ImageSideTooLong with { Message = $"{label}: each side must be at most {maxSide}." });
        }

        var pixels = (long)size.Width * size.Height;
        if (capabilities.MinPixels is { } minPixels && pixels < minPixels)
        {
            problems.Add(ErrorCodes.ImageTooFewPixels with { Message = $"{label}: the image must have at least {minPixels:N0} pixels." });
        }

        if (capabilities.MaxPixels is { } maxPixels && pixels > maxPixels)
        {
            problems.Add(ErrorCodes.ImageTooManyPixels with { Message = $"{label}: the image must have at most {maxPixels:N0} pixels." });
        }

        if (capabilities.MaxAspectRatio is { } maxRatio && (double)Math.Max(size.Width, size.Height) / Math.Min(size.Width, size.Height) > maxRatio)
        {
            problems.Add(ErrorCodes.ImageAspectRatioTooWide with { Message = $"{label}: the long side may be at most {maxRatio} times the short side." });
        }
    }
}
