using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ReverseMarkdown;
using SmartReader;

namespace ChatUitReact.Server.Services.Tools;

public sealed record GetWebsiteArgs(
    [property: Description("The full URL of the page to fetch.")]
    string Url);

/// <summary>Fetches a web page, extracts the main content and returns it as Markdown with absolute links.</summary>
public sealed class GetWebsiteTool : Tool<GetWebsiteArgs>
{
  public override string Id => "get_website";

  public override string DisplayName => "Fetch Web Page";

  public override string Description => "Fetch a webpage, extract the main content, and return Markdown with links preserved (absolute URLs).";

  public override IReadOnlyList<string> LegacyIds => ["fetch_tool"];

  protected override async Task<ToolResult> ExecuteAsync(GetWebsiteArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
  {
    var url = args.Url;
    if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var baseUri))
      return ToolResult.Error("Invalid URL");

    try
    {
      var reader = new Reader(url);

      var article = await reader.GetArticleAsync();
      if (article == null || (string.IsNullOrWhiteSpace(article.Content) && string.IsNullOrWhiteSpace(article.TextContent)))
        return ToolResult.Error($"No extractable content at {url}");

      // Prefer SmartReader's cleaned HTML; fallback to plain text.
      var extractedHtml = string.IsNullOrWhiteSpace(article.Content) ? article.TextContent : article.Content;

      // HTML -> Markdown (links preserved)
      var converter = new Converter(new Config
      {
        GithubFlavored = true,
        Formatting = { RemoveComments = true },
        Tags = { Unknown = Config.UnknownTagsOption.Drop }
      });
      var markdown = converter.Convert(extractedHtml ?? string.Empty);

      // Make sure links/images are ABSOLUTE (SmartReader usually does this already; this is a safety net on the Markdown)
      markdown = AbsolutizeMarkdownLinks(markdown, baseUri);

      // Normalize spacing and add provenance
      var title = string.IsNullOrWhiteSpace(article.Title) ? baseUri.Host : article.Title.Trim();
      var output = $"# {title}\n\n{PostProcessMarkdown(markdown)}\n\nSource: {baseUri}";

      return ToolResult.Ok(new { url, content = output });
    }
    catch (Exception ex)
    {
      return ToolResult.Error($"Fetch failed: {ex.Message}");
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
