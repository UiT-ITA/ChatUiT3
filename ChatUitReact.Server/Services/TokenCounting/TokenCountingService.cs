using ChatUitReact.Server.Models;
using Microsoft.ML.Tokenizers;

namespace ChatUitReact.Server.Services.TokenCounting;

/// <summary>
/// Token counting against the same text the providers send. Text is exact for the tiktoken
/// encodings. The constants below are the only approximations for OpenAI models: the
/// per-message framing and the tool definition formatting are undocumented for the
/// Responses API, so the Chat Completions cookbook numbers are used.
/// </summary>
public sealed class TokenCountingService : ITokenCountingService
{
    /// <summary>Per-message overhead: cookbook tokens_per_message (3) plus the role (1). Mirrored on the client.</summary>
    public const int MessageFramingTokens = 4;

    /// <summary>Cookbook reply priming: &lt;|start|&gt;assistant&lt;|message|&gt;.</summary>
    private const int ReplyPrimingTokens = 3;

    // Cookbook num_tokens_for_tools constants (gpt-4o family).
    private const int ToolFunctionInit = 7;
    private const int ToolPropertyInit = 3;
    private const int ToolPropertyKey = 3;
    private const int ToolEnumInit = -3;
    private const int ToolEnumItem = 3;
    private const int ToolFunctionEnd = 12;

    // The client bounds images to this; used when a header cannot be read.
    private const int FallbackImageWidth = 2048;
    private const int FallbackImageHeight = 1024;

    private readonly IModelService _modelService;
    private readonly ILogger<TokenCountingService> _logger;
    private readonly Lazy<TiktokenTokenizer> _o200k = new(() => TiktokenTokenizer.CreateForEncoding("o200k_base"));
    private readonly Lazy<TiktokenTokenizer> _cl100k = new(() => TiktokenTokenizer.CreateForEncoding("cl100k_base"));

    public TokenCountingService(IModelService modelService, ILogger<TokenCountingService> logger)
    {
        _modelService = modelService;
        _logger = logger;
    }

    public async Task<IReadOnlyList<string>> GetActiveSchemeIdsAsync()
    {
        var models = await _modelService.GetAllModelsAsync();
        return models
            .Select(m => TokenCountingSchemes.Normalize(m.Capabilities.TokenCountingScheme))
            .Where(id => id != null && TokenCountingSchemes.IsKnown(id))
            .Select(id => id!)
            .Distinct()
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToList();
    }

    public int CountText(string text, string schemeId) => CountText(text, Parse(schemeId));

    public int CountImage(int width, int height, string schemeId) =>
        ImageTokenMath.Tokens(width, height, Parse(schemeId).ImageCost);

    public int CountMessage(ChatMessage message, string schemeId) =>
        CountMessage(message, new[] { schemeId }).Total[schemeId];

    public MessageTokenCounts CountMessage(ChatMessage message, IReadOnlyList<string> schemeIds)
    {
        var hasFiles = message.Files is { Count: > 0 };
        var schemes = schemeIds.Select(Parse).ToList();
        var parts = MessageParts.Build(message, allowImages: true);

        // Text is counted once per text rule and shared by every scheme using it; only the
        // image term differs between, say, o200k-tile and o200k-patch-1.62.
        var textRuns = ConcatenateTextRuns(parts);
        var textTokensByRule = new Dictionary<(TextEncoding, double?), int>();
        var contentTokensByRule = new Dictionary<(TextEncoding, double?), int>();
        foreach (var scheme in schemes.DistinctBy(s => s.TextRule))
        {
            textTokensByRule[scheme.TextRule] = textRuns.Sum(run => CountText(run, scheme));
            if (hasFiles)
            {
                contentTokensByRule[scheme.TextRule] = CountText(message.Content ?? string.Empty, scheme);
            }
        }

        var imageDimensions = parts.OfType<ImagePart>().Select(ReadDimensions).ToList();

        var total = new Dictionary<string, int>();
        var files = new Dictionary<string, int>();
        foreach (var scheme in schemes)
        {
            var imageTokens = imageDimensions.Sum(d => ImageTokenMath.Tokens(d.Width, d.Height, scheme.ImageCost));
            var tokens = MessageFramingTokens + textTokensByRule[scheme.TextRule] + imageTokens;
            total[scheme.Id] = tokens;

            // The attachment share is derived by subtraction, leaving the total (and the wire
            // format it mirrors) untouched. The message text and the first file header share
            // one text run, so the split can be off by a token at that boundary.
            if (hasFiles)
            {
                files[scheme.Id] = Math.Max(0, tokens - MessageFramingTokens - contentTokensByRule[scheme.TextRule]);
            }
        }

        return new MessageTokenCounts(total, files);
    }

    public int CountSystemPrompt(string systemPrompt, IReadOnlyList<ChatTool> tools, string schemeId)
    {
        var scheme = Parse(schemeId);
        var total = ReplyPrimingTokens;

        if (!string.IsNullOrEmpty(systemPrompt))
        {
            total += CountText(systemPrompt, scheme) + MessageFramingTokens;
        }

        if (tools.Count > 0)
        {
            foreach (var tool in tools)
            {
                total += ToolFunctionInit;
                total += CountText($"{tool.FunctionName}:{TrimPeriod(tool.Description)}", scheme);

                if (tool.Parameters.Count > 0)
                {
                    total += ToolPropertyInit;
                    foreach (var parameter in tool.Parameters)
                    {
                        total += ToolPropertyKey;
                        total += CountText($"{parameter.Name}:{parameter.Type}:{TrimPeriod(parameter.Description)}", scheme);

                        if (parameter.Enum is { Length: > 0 })
                        {
                            total += ToolEnumInit;
                            foreach (var value in parameter.Enum)
                            {
                                total += ToolEnumItem + CountText(value, scheme);
                            }
                        }
                    }
                }
            }

            total += ToolFunctionEnd;
        }

        return total;
    }

    public bool FillMissingMessageCounts(ChatMessage message, IReadOnlyList<string> schemeIds)
    {
        message.TokenCounts ??= new Dictionary<string, int>();
        message.FileTokenCounts ??= new Dictionary<string, int>();
        var hasFiles = message.Files is { Count: > 0 };

        var missing = schemeIds
            .Where(id => !message.TokenCounts.ContainsKey(id) || (hasFiles && !message.FileTokenCounts.ContainsKey(id)))
            .ToList();
        if (missing.Count == 0)
        {
            return false;
        }

        var counts = CountMessage(message, missing);
        foreach (var (schemeId, tokens) in counts.Total)
        {
            message.TokenCounts[schemeId] = tokens;
        }
        foreach (var (schemeId, tokens) in counts.Files)
        {
            message.FileTokenCounts[schemeId] = tokens;
        }

        return true;
    }

    private int CountText(string text, TokenCountingScheme scheme)
    {
        if (string.IsNullOrEmpty(text))
        {
            return 0;
        }

        return scheme.Encoding switch
        {
            TextEncoding.O200kBase => _o200k.Value.CountTokens(text),
            TextEncoding.Cl100kBase => _cl100k.Value.CountTokens(text),
            TextEncoding.CharEstimate => (int)Math.Ceiling(text.Length / (scheme.CharsPerToken
                ?? throw new InvalidOperationException($"Scheme '{scheme.Id}' has no chars-per-token ratio."))),
            // Whitespace-separated words; the client's /\s+/ split gives the same count.
            TextEncoding.WordCount => text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length,
            _ => throw new ArgumentOutOfRangeException(nameof(scheme), scheme.Encoding, "Unknown text encoding")
        };
    }

    private (int Width, int Height) ReadDimensions(ImagePart image)
    {
        if (ImageHeaderReader.TryReadDimensions(image.Base64, out var width, out var height))
        {
            return (width, height);
        }

        _logger.LogDebug("Could not read image dimensions ({MediaType}); assuming {Width}x{Height}", image.MediaType, FallbackImageWidth, FallbackImageHeight);
        return (FallbackImageWidth, FallbackImageHeight);
    }

    // Adjacent text parts are one string on the wire as far as the tokenizer is concerned;
    // counting them separately would over-count at every boundary.
    private static List<string> ConcatenateTextRuns(List<MessagePart> parts)
    {
        var runs = new List<string>();
        var current = new System.Text.StringBuilder();

        foreach (var part in parts)
        {
            if (part is TextPart text)
            {
                current.Append(text.Text);
            }
            else if (current.Length > 0)
            {
                runs.Add(current.ToString());
                current.Clear();
            }
        }

        if (current.Length > 0)
        {
            runs.Add(current.ToString());
        }

        return runs;
    }

    private static string TrimPeriod(string value) => value.TrimEnd('.');

    private static TokenCountingScheme Parse(string schemeId)
    {
        if (!TokenCountingSchemes.TryParse(schemeId, out var scheme))
        {
            throw new ArgumentException($"Unknown token counting scheme '{schemeId}'.", nameof(schemeId));
        }

        return scheme;
    }
}
