using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using AngleSharp;
using AngleSharp.Dom;
using AngleSharp.Html.Dom;
using ChatUitReact.Server.Models;
using ReverseMarkdown;
using SmartReader;

namespace ChatUitReact.Server.Services.Tools;

public sealed record GetWebsiteArgs(
    [property: Description("The full URL of the page to fetch.")]
    string Url);

/// <summary>
/// Fetches a web page and returns it as Markdown with absolute links. Uses whichever is longer of the
/// Readability-style article extraction and the whole page with non-content elements removed.
/// </summary>
public sealed class GetWebsiteTool : Tool<GetWebsiteArgs>
{
  public override string Id => "get_website";

  public override string DisplayName => "Fetch Web Page";

  public override string Description => "Fetch a webpage, extract the main content, and return Markdown with links preserved (absolute URLs).";

  public override IReadOnlyList<string> LegacyIds => ["fetch_tool"];

  private const string UserAgent = "SmartReader Library";

  private const string NonContentSelector =
    "script,style,noscript,svg,iframe,nav,header,footer,aside,[role=navigation],[role=banner],[role=contentinfo],[role=complementary]";

  private const string MainContentSelector = "main,[role=main],article";

  /// <summary>Share of the page text a main/article element must hold to be used instead of the whole body.</summary>
  private const double MainContentMinShare = 0.25;

  private readonly IHttpClientFactory _httpClientFactory;

  public GetWebsiteTool(IHttpClientFactory httpClientFactory)
  {
    _httpClientFactory = httpClientFactory;
  }

  protected override async Task<ToolResult> ExecuteAsync(GetWebsiteArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
  {
    var url = args.Url;
    if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var baseUri))
      return ToolResult.Error("Invalid URL");

    try
    {
      var html = await FetchHtmlAsync(baseUri, cancellationToken);

      // Readability-style extraction of the single main article
      var article = new Reader(url, html).GetArticle();
      var readerHtml = string.IsNullOrWhiteSpace(article?.Content) ? article?.TextContent : article.Content;

      // Whole page with boilerplate elements removed
      var structuralHtml = await ExtractStructuralHtmlAsync(html, baseUri, cancellationToken);

      // HTML -> Markdown (links preserved)
      var converter = new Converter(new Config
      {
        GithubFlavored = true,
        Formatting = { RemoveComments = true },
        Tags = { Unknown = Config.UnknownTagsOption.Drop }
      });
      var readerMarkdown = converter.Convert(readerHtml ?? string.Empty);
      var structuralMarkdown = converter.Convert(structuralHtml);
      var markdown = structuralMarkdown.Length >= readerMarkdown.Length ? structuralMarkdown : readerMarkdown;

      if (string.IsNullOrWhiteSpace(markdown))
        return ToolResult.Error($"No extractable content at {url}");

      // Make sure links/images are ABSOLUTE (safety net on the Markdown)
      markdown = AbsolutizeMarkdownLinks(markdown, baseUri);

      // Normalize spacing and add provenance
      var title = string.IsNullOrWhiteSpace(article?.Title) ? baseUri.Host : article.Title.Trim();
      var output = $"# {title}\n\n{PostProcessMarkdown(markdown)}\n\nSource: {baseUri}";

      return ToolResult.Ok(new { url, content = output });
    }
    catch (Exception ex)
    {
      return ToolResult.Error($"Fetch failed: {ex.Message}");
    }
  }

  private async Task<string> FetchHtmlAsync(Uri uri, CancellationToken cancellationToken)
  {
    using var request = new HttpRequestMessage(HttpMethod.Get, uri);
    request.Headers.UserAgent.ParseAdd(UserAgent);

    using var response = await _httpClientFactory.CreateClient(nameof(GetWebsiteTool)).SendAsync(request, cancellationToken);
    response.EnsureSuccessStatusCode();
    return await response.Content.ReadAsStringAsync(cancellationToken);
  }

  /// <summary>
  /// Removes non-content elements, makes links and images absolute, and returns the inner HTML of the
  /// largest main/article element, or of the body when no such element holds enough of the page text.
  /// </summary>
  private static async Task<string> ExtractStructuralHtmlAsync(string html, Uri baseUri, CancellationToken cancellationToken)
  {
    using var context = BrowsingContext.New(Configuration.Default);
    using var document = await context.OpenAsync(r => r.Content(html).Address(baseUri), cancellationToken);
    if (document.Body is null)
      return string.Empty;

    foreach (var element in document.QuerySelectorAll(NonContentSelector).ToList())
      element.Remove();

    foreach (var anchor in document.QuerySelectorAll<IHtmlAnchorElement>("a[href]"))
      anchor.SetAttribute("href", anchor.Href);
    foreach (var image in document.QuerySelectorAll<IHtmlImageElement>("img[src]"))
      image.SetAttribute("src", image.Source);

    var bodyLength = document.Body.TextContent.Length;
    var root = document.QuerySelectorAll(MainContentSelector)
      .OrderByDescending(e => e.TextContent.Length)
      .FirstOrDefault(e => e.TextContent.Length >= bodyLength * MainContentMinShare)
      ?? document.Body;

    return root.InnerHtml;
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
