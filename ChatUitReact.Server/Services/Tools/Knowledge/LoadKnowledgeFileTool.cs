using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;
using ChatUitReact.Server.Services.TokenCounting;
using Microsoft.Extensions.Logging;

namespace ChatUitReact.Server.Services.Tools;

public enum KnowledgeLoadMode
{
    /// <summary>The content is returned for this turn only.</summary>
    Temporary,

    /// <summary>The file is pinned to the chat and is carried as a leading message on every later turn.</summary>
    Permanent
}

public sealed record LoadKnowledgeFileArgs(
    [property: Description("The id of the knowledge file, as listed under \"On-demand knowledge files\".")]
    string FileId,
    [property: Description("\"temporary\" (default) returns the content for this turn only. \"permanent\" keeps the whole file in your context for the rest of the conversation; use it when the file will be needed again.")]
    KnowledgeLoadMode? Mode,
    [property: Description("Character offset to continue reading a long file from. Pass the nextOffset from a previous result. Defaults to 0.")]
    int? Offset);

/// <summary>
/// Loads one of an assistant's on-demand knowledge files. Built per request for the assistant
/// the chat runs on, so it is not in the registry: users cannot pick it, and the model only
/// sees it when the assistant has on-demand files.
///
/// Long files are returned in windows that fit under the tool output cap. A permanent load
/// also pins the file on the chat; that turn still gets the content through the result, and
/// from the next turn <see cref="KnowledgeFileMessages"/> carries the file as a message. Pinned
/// files are not in <c>files</c> on later turns, so they cannot be loaded twice.
/// </summary>
public sealed class LoadKnowledgeFileTool : Tool<LoadKnowledgeFileArgs>
{
    public const string ToolId = "load_knowledge_file";

    /// <summary>
    /// Room left under the output cap for the JSON envelope around the content, so a full window
    /// never trips the executor's truncation. The window is therefore the cap minus this.
    /// </summary>
    private const int EnvelopeHeadroomChars = 1_000;

    private readonly string _assistantId;
    private readonly IReadOnlyList<AssistantFile> _files;
    private readonly IDatabaseService _database;
    private readonly ITokenCountingService _tokenCounting;
    private readonly ILogger _logger;
    private readonly int _windowChars;

    public LoadKnowledgeFileTool(
        string assistantId,
        IReadOnlyList<AssistantFile> files,
        IDatabaseService database,
        ITokenCountingService tokenCounting,
        ToolOptions options,
        ILogger logger)
    {
        _assistantId = assistantId;
        _files = files;
        _database = database;
        _tokenCounting = tokenCounting;
        _logger = logger;
        _windowChars = Math.Max(1_000, options.MaxModelContentChars - EnvelopeHeadroomChars);
    }

    public override string Id => ToolId;

    public override string DisplayName => "Load knowledge file";

    public override string Description =>
        "Read one of the assistant's on-demand knowledge files. Temporary loads return the content for this turn; " +
        "permanent loads keep the file in context for the rest of the conversation. Long files come in parts.";

    protected override async Task<ToolResult> ExecuteAsync(LoadKnowledgeFileArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
    {
        var fileId = args.FileId?.Trim() ?? string.Empty;
        var known = _files.FirstOrDefault(f => f.Id == fileId);
        if (known == null)
        {
            var available = string.Join(", ", _files.Select(f => $"{f.Id} ({f.SourceFilename})"));
            return ToolResult.Error($"Unknown file id '{fileId}'. Available files: {available}");
        }

        var loaded = await _database.GetAssistantFileAsync(_assistantId, fileId);
        var text = loaded == null ? string.Empty : KnowledgeFileMessages.TextOf(loaded);
        if (string.IsNullOrWhiteSpace(text))
        {
            return ToolResult.Error($"File '{known.SourceFilename}' has no text content.");
        }

        var mode = args.Mode ?? KnowledgeLoadMode.Temporary;
        if (mode == KnowledgeLoadMode.Permanent && !await PinAsync(invocation.Context, loaded!))
        {
            return ToolResult.Error($"Could not keep '{known.SourceFilename}' loaded: the chat was not found. Load it temporarily instead.");
        }

        var offset = Math.Clamp(args.Offset ?? 0, 0, text.Length);
        var end = Math.Min(text.Length, offset + _windowChars);
        var hasMore = end < text.Length;
        var modeName = mode.ToString().ToLowerInvariant();

        return ToolResult.Ok(new
        {
            fileId,
            filename = known.SourceFilename,
            mode = modeName,
            offset,
            end,
            totalChars = text.Length,
            hasMore,
            nextOffset = hasMore ? end : (int?)null,
            note = mode == KnowledgeLoadMode.Permanent
                ? "Pinned. From the next message on this file is in your context without calling this tool."
                : null,
            content = text[offset..end]
        }, display: $"{known.SourceFilename} ({offset}-{end} of {text.Length} chars, {modeName})");
    }

    // Counted as the message that will carry the file on later turns, so the chat's pinned
    // cost matches what is sent.
    private async Task<bool> PinAsync(ToolExecutionContext context, AssistantFile file)
    {
        if (context.ChatId == null)
        {
            return false;
        }

        var message = KnowledgeFileMessages.For(file);
        var counts = new Dictionary<string, int>();
        foreach (var scheme in await _tokenCounting.GetActiveSchemeIdsAsync())
        {
            counts[scheme] = _tokenCounting.CountMessage(message, scheme);
        }

        var pinned = await _database.AddChatLoadedFileAsync(context.UserId, context.ChatId, new ChatLoadedFile
        {
            FileId = file.Id,
            SourceFilename = file.SourceFilename,
            TokenCounts = counts
        });
        if (pinned)
        {
            _logger.LogInformation("Pinned file {FileId} ({Filename}) to chat {ChatId}", file.Id, file.SourceFilename, context.ChatId);
        }
        else
        {
            _logger.LogWarning("Could not pin file {FileId} to chat {ChatId}: chat not found", file.Id, context.ChatId);
        }

        return pinned;
    }
}
