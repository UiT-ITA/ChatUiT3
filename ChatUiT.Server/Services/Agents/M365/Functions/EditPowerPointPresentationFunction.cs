using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Office;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public enum PowerPointOperationType
{
    SetShapeText,
    ReplaceText,
    AddSlide,
    DuplicateSlide,
    DeleteSlide,
    MoveSlide
}

public sealed record PowerPointOperation(
    [property: Description("setShapeText: replace a shape's text. replaceText: find → replace on one slide, or all slides without slide. addSlide: new slide from a layout after slide, or at the end, with title and body. duplicateSlide: copy a slide in after it. deleteSlide. moveSlide: move a slide to position.")]
    PowerPointOperationType Type,
    [property: Description("Slide number from read_file.")]
    int? Slide,
    [property: Description("Shape id [shape N] from read_file, for setShapeText.")]
    int? Shape,
    [property: Description("Text for setShapeText. Each line becomes a paragraph.")]
    string? Text,
    [property: Description("Exact text to find, case-sensitive.")]
    string? Find,
    [property: Description("Replacement text for replaceText. An empty string deletes the found text.")]
    string? Replace,
    [property: Description("Layout name from read_file, for addSlide. Defaults to \"Title and Content\" or the first layout.")]
    string? Layout,
    [property: Description("Title for addSlide.")]
    string? Title,
    [property: Description("Body text for addSlide. Each line becomes a paragraph.")]
    string? Body,
    [property: Description("New position for moveSlide, from 1.")]
    int? Position);

public sealed record EditPowerPointPresentationArgs(
    [property: Description("driveId from read_file.")]
    string DriveId,
    [property: Description("itemId from read_file.")]
    string ItemId,
    [property: Description("version from read_file. The edit is refused if the file changed since.")]
    string Version,
    [property: Description("The changes, applied in order. Slide numbers refer to the presentation as read_file returned it.")]
    List<PowerPointOperation> Operations);

/// <summary>Edits a .pptx file in OneDrive or SharePoint after the user has approved the changes.</summary>
public sealed class EditPowerPointPresentationFunction : ConfirmableTool<EditPowerPointPresentationArgs>
{
    private readonly GraphClient _graph;

    public EditPowerPointPresentationFunction(GraphClient graph) => _graph = graph;

    public override string Id => "edit_powerpoint_presentation";
    public override string DisplayName => "Edit PowerPoint presentation";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Edit a PowerPoint presentation (.pptx) in OneDrive or SharePoint: set or replace text in shapes, and add, duplicate, delete or move slides. Read it with read_file first and use its numbers and version. Put all changes for one request in one call. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(EditPowerPointPresentationArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var loaded = await OfficeFiles.LoadAsync(_graph, invocation.Context, args.DriveId, args.ItemId, ".pptx", args.Version, ct);
        var (bytes, changes) = PowerPointPresentations.Apply(loaded.Bytes, args.Operations ?? []);
        OfficeFiles.Remember(invocation, args, loaded, bytes, changes);

        return new ToolPreview(
            "Edit PowerPoint presentation",
            null,
            [new ToolPreviewField("Presentation", loaded.Name), new ToolPreviewField("Changes", OfficeFiles.Numbered(changes), Multiline: true)],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(EditPowerPointPresentationArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var prepared = OfficeFiles.Take(invocation, args);
        var loaded = prepared?.Loaded ?? await OfficeFiles.LoadAsync(_graph, invocation.Context, args.DriveId, args.ItemId, ".pptx", args.Version, ct);
        var (bytes, changes) = prepared != null ? (prepared.Bytes, prepared.Changes) : PowerPointPresentations.Apply(loaded.Bytes, args.Operations ?? []);
        var item = await OfficeFiles.SaveAsync(_graph, invocation.Context, args.DriveId, args.ItemId, loaded, bytes, PowerPointPresentations.MediaType, ct);

        return ToolResult.Ok(
            new { edited = true, name = loaded.Name, webUrl = item.Str("webUrl") ?? loaded.WebUrl, changes, note = "The numbers and version have changed. Read the presentation again before the next edit." },
            $"Edited {loaded.Name}.");
    }
}
