using System.Text.Json;
using System.Text.RegularExpressions;
using ChatUitReact.Server.Models;
using SmartReader;
using ReverseMarkdown;

namespace ChatUitReact.Server.Services.Tools;

public class FetchTool : ChatTool
{
  public new string Id { get; set; } = "fetch_tool";
  public override string Name => "Fetch Web Page";
  public override string Description => "Fetch a webpage, extract the main content, and return Markdown with links preserved (absolute URLs).";
  public override string FunctionName => "fetch_page";
  public override List<ChatToolParameter> Parameters => new()
  {
    new ChatToolParameter
    {
      Name = "url",
      Type = "string",
      Description = "The full URL of the page to fetch."
    }
  };
  public override List<string> RequiredParameters => new() { "url" };

  public override async Task<string> ExecuteAsync(JsonElement args, ToolContext ctx, CancellationToken ct)
  {
    if (!args.TryGetProperty("url", out var urlEl) || urlEl.ValueKind != JsonValueKind.String)
      return """{"error":"Missing required argument: url"}""";

    var url = urlEl.GetString();
    if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var baseUri))
      return """{"error":"Invalid URL"}""";

    try
    {
      var reader = new Reader(url);

      var article = await reader.GetArticleAsync();
      if (article == null || (string.IsNullOrWhiteSpace(article.Content) && string.IsNullOrWhiteSpace(article.TextContent)))
        return $$"""{"error":"No extractable content","url":"{{url}}"}""";

      // Prefer SmartReader’s cleaned HTML; fallback to plain text.
      var extractedHtml = string.IsNullOrWhiteSpace(article.Content) ? article.TextContent : article.Content;

      // HTML -> Markdown (links preserved)
      var converter = new Converter(new Config
      {
        GithubFlavored = true,
        RemoveComments = true,
        UnknownTags = Config.UnknownTagsOption.Drop
      });
      var markdown = converter.Convert(extractedHtml ?? string.Empty);

      // Make sure links/images are ABSOLUTE (SmartReader usually does this already; this is a safety net on the Markdown)
      markdown = AbsolutizeMarkdownLinks(markdown, baseUri);

      // Normalize spacing and add provenance
      var title = string.IsNullOrWhiteSpace(article.Title) ? baseUri.Host : article.Title.Trim();
      var output = $"# {title}\n\n{PostProcessMarkdown(markdown)}\n\nSource: {baseUri}";

      return JsonSerializer.Serialize(new { url, content = output });
    }
    catch (Exception ex)
    {
      return JsonSerializer.Serialize(new { error = "Exception occurred", message = ex.Message });
    }
  }

  private static string PostProcessMarkdown(string md)
  {
    if (string.IsNullOrEmpty(md)) return string.Empty;

    // Collapse >1 blank line to a single
    md = Regex.Replace(md.Replace("\r\n", "\n"), @"\n{3,}", "\n\n");

    // Trim trailing spaces per line
    md = string.Join("\n", md.Split('\n').Select(l => l.TrimEnd()));

    return md.Trim();
  }

  private static string AbsolutizeMarkdownLinks(string md, Uri baseUri)
  {
    if (string.IsNullOrEmpty(md)) return md;

    // Handle both links and images: ![alt](url) and [text](url)
    var pattern = new Regex(@"(!?\[.*?\])\((.*?)\)", RegexOptions.Compiled);
    return pattern.Replace(md, m =>
    {
      var label = m.Groups[1].Value;
      var href = m.Groups[2].Value.Trim();

      // Already absolute or non-http schemes
      if (Uri.TryCreate(href, UriKind.Absolute, out var abs) && (abs.Scheme == Uri.UriSchemeHttp || abs.Scheme == Uri.UriSchemeHttps))
        return $"{label}({abs})";
      if (href.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) || href.StartsWith("tel:", StringComparison.OrdinalIgnoreCase) || href.StartsWith("#"))
        return $"{label}({href})";

      // Try to resolve relative to base
      if (Uri.TryCreate(baseUri, href, out var resolved))
        return $"{label}({resolved})";

      return m.Value; // fallback unchanged
    });
  }
}
