namespace ChatUiT.Server.Services.AiProviders;

/// <summary>
/// The user facts a snippet may read. Resolved once per request from the stored profile and
/// the caller's claims, so the assembler itself never touches either.
/// </summary>
public sealed record PromptUserContext(string Name, string JobRole, string Email, string AnswerPreferences);

/// <summary>
/// The fixed snippets an assistant owner can tick in the builder. Each is stored on the
/// assistant by id and rendered by <see cref="SystemPromptAssembler"/> as its own section
/// after the owner's instructions, so the instructions text is never edited.
/// </summary>
public static class PromptSnippets
{
    public const string FormatMarkdown = "formatMarkdown";
    public const string Equations = "equations";
    public const string HtmlVisuals = "htmlVisuals";
    public const string BasicUserInfo = "basicUserInfo";
    public const string AnswerPreferences = "answerPreferences";

    /// <summary>Registry order, which is also render order.</summary>
    public static readonly IReadOnlyList<string> Known = new[]
    {
        FormatMarkdown,
        Equations,
        HtmlVisuals,
        BasicUserInfo,
        AnswerPreferences
    };

    public const string FormatMarkdownText =
        "Format your answer using Markdown (headings, lists, emphasis, tables and fenced code blocks where they help readability).";

    public const string EquationsText =
        "Write mathematics in LaTeX inside Markdown:\n" +
        "- Inline formulas: use `$...$` for formulas inside text, e.g. `$E = mc^2$`.\n" +
        "- Display formulas: use `$$...$$` on their own lines for centered formulas, e.g.\n" +
        "$$\n" +
        "E = mc^2\n" +
        "$$";

    public const string HtmlVisualsText =
        "When a visual helps the answer (a chart, a diagram, an interactive demo or a small tool), show it as a live HTML page: " +
        "write a complete, self-contained HTML page with its CSS and JavaScript in a fenced code block with the language `html-preview`. " +
        "The user sees the rendered page and can switch to the source.\n" +
        "- The page runs in a sandbox. It can load scripts, styles and fonts only from https://cdn.jsdelivr.net (for example Chart.js or D3), with exact versions in the URLs. All other network requests are blocked.\n" +
        "- It has no fetch, forms, pop-ups, cookies or local storage, and no access to the conversation, so put all data in the page.\n" +
        "- Use a fenced code block with the language `html` instead when the user wants to read or copy HTML source.";

    /// <summary>Known ids only, de-duplicated, in registry order.</summary>
    public static List<string> Normalize(IEnumerable<string>? requested)
    {
        if (requested == null)
        {
            return new List<string>();
        }

        var set = requested.ToHashSet(StringComparer.Ordinal);
        return Known.Where(set.Contains).ToList();
    }
}
