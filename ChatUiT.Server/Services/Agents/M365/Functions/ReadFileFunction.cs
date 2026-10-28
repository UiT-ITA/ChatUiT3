using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Office;
using ChatUiT.Server.Services.TokenCounting;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ReadFileArgs(
    [property: Description("driveId from search_files.")]
    string DriveId,
    [property: Description("itemId from search_files.")]
    string ItemId);

public sealed class ReadFileFunction : Tool<ReadFileArgs>
{
    private const long MaxBytes = 512 * 1024;
    private const long MaxImageBytes = 5 * 1024 * 1024;

    // Graph renders a JPEG that fits in this box, which also covers HEIC and very large photos.
    private const string ImageSize = "c1568x1568";

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".heic", ".heif", ".tif", ".tiff" };

    private static readonly string[] Scopes = [M365Scopes.FilesReadWriteAll];

    private readonly GraphClient _graph;

    public ReadFileFunction(GraphClient graph) => _graph = graph;

    public override string Id => "read_file";
    public override string DisplayName => "Read file";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Read a file from OneDrive or SharePoint: Word (.docx), PowerPoint (.pptx) and Excel (.xlsx) documents with numbered paragraphs, slides and cells, images, and text files (txt, md, csv, json, xml, html, code). Other files return metadata only. The version it returns is needed to edit a Word or PowerPoint file.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ReadFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.DriveId) || string.IsNullOrWhiteSpace(args.ItemId))
        {
            return ToolResult.Error("driveId and itemId are required.");
        }

        var itemPath = $"drives/{Uri.EscapeDataString(args.DriveId.Trim())}/items/{Uri.EscapeDataString(args.ItemId.Trim())}";
        var item = await _graph.GetAsync(invocation.Context, $"{itemPath}?$select=id,name,size,webUrl,file,folder,lastModifiedDateTime,eTag", Scopes, ct);

        var name = item.Str("name") ?? string.Empty;
        var size = long.TryParse(item.Str("size"), out var s) ? s : 0;
        var mimeType = item.Str("file", "mimeType");
        var metadata = new { name, size, mimeType, lastModified = item.Str("lastModifiedDateTime"), webUrl = item.Str("webUrl") };

        if (item.TryGetProperty("folder", out _))
        {
            return ToolResult.Ok(new { metadata, content = (string?)null, note = "This item is a folder." });
        }

        var extension = Path.GetExtension(name);
        if (extension.Equals(".docx", StringComparison.OrdinalIgnoreCase) || extension.Equals(".pptx", StringComparison.OrdinalIgnoreCase))
        {
            if (size > OfficeFiles.MaxBytes)
            {
                return ToolResult.Ok(new { metadata, content = (string?)null, note = $"The file is larger than {OfficeFiles.MaxBytes / (1024 * 1024)} MB." });
            }

            var bytes = await _graph.GetBytesAsync(invocation.Context, $"{itemPath}/content", Scopes, OfficeFiles.MaxBytes, ct);
            var content = extension.Equals(".docx", StringComparison.OrdinalIgnoreCase) ? WordDocuments.Read(bytes) : PowerPointPresentations.Read(bytes);
            return ToolResult.Ok(new { metadata, driveId = args.DriveId.Trim(), itemId = args.ItemId.Trim(), version = item.Str("eTag"), content });
        }

        if (extension.Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            var content = await ExcelWorkbooks.ReadOverviewAsync(_graph, invocation.Context, $"{itemPath}/workbook", ct);
            return ToolResult.Ok(new { metadata, driveId = args.DriveId.Trim(), itemId = args.ItemId.Trim(), content });
        }

        if (ImageExtensions.Contains(extension) || (mimeType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ?? false))
        {
            try
            {
                var (bytes, mediaType) = await _graph.DownloadAsync(invocation.Context, $"{itemPath}/thumbnails/0/{ImageSize}/content", Scopes, MaxImageBytes, ct);
                var image = new ImagePart(Convert.ToBase64String(bytes), mediaType ?? "image/jpeg");
                return ToolResult.Ok(new { metadata, note = "The image is attached." }) with { Images = [image] };
            }
            catch (GraphRequestException ex) when (ex.Status == HttpStatusCode.NotFound)
            {
                return ToolResult.Ok(new { metadata, content = (string?)null, note = "No preview of this image is available; share the web link instead." });
            }
        }

        if (!TextFiles.IsText(name, mimeType))
        {
            return ToolResult.Ok(new { metadata, content = (string?)null, note = "Content is not readable as text; share the web link instead." });
        }

        var text = await _graph.GetTextAsync(invocation.Context, $"{itemPath}/content", Scopes, MaxBytes, ct);
        var truncated = size > MaxBytes;

        return ToolResult.Ok(new { metadata, content = text, truncated });
    }
}
