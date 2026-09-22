namespace ChatUitReact.Server.Services.AiProviders;

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
    public const string BasicUserInfo = "basicUserInfo";
    public const string AnswerPreferences = "answerPreferences";

    /// <summary>Registry order, which is also render order.</summary>
    public static readonly IReadOnlyList<string> Known = new[]
    {
        FormatMarkdown,
        Equations,
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
