using System.Text;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.AiProviders;

/// <summary>
/// Builds the system prompt exactly as it goes to the provider. Used both when sending and
/// when counting an assistant's fixed token cost, so the counted prompt is byte-identical
/// to the sent one.
///
/// Order: the owner's instructions verbatim, then one section per enabled snippet group,
/// then the knowledge files. Sections are joined with a blank line.
/// </summary>
public static class SystemPromptAssembler
{
    public static string Build(
        string systemPrompt,
        IReadOnlyList<string> snippetIds,
        PromptUserContext? user,
        List<AssistantFile> files)
    {
        var sections = new List<string>();

        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            sections.Add(systemPrompt);
        }

        var guidelines = BuildResponseGuidelines(snippetIds);
        if (guidelines != null)
        {
            sections.Add(guidelines);
        }

        if (snippetIds.Contains(PromptSnippets.BasicUserInfo))
        {
            sections.Add(BuildAboutUser(user));
        }

        if (snippetIds.Contains(PromptSnippets.AnswerPreferences))
        {
            var preferences = user?.AnswerPreferences.Trim();
            if (!string.IsNullOrEmpty(preferences))
            {
                sections.Add($"# How the user wants answers\n{preferences}");
            }
        }

        var knowledge = BuildKnowledgeFiles(files);
        if (knowledge != null)
        {
            sections.Add(knowledge);
        }

        return string.Join("\n\n", sections);
    }

    private static string? BuildResponseGuidelines(IReadOnlyList<string> snippetIds)
    {
        var blocks = new List<string>();
        if (snippetIds.Contains(PromptSnippets.FormatMarkdown))
        {
            blocks.Add(PromptSnippets.FormatMarkdownText);
        }
        if (snippetIds.Contains(PromptSnippets.Equations))
        {
            blocks.Add(PromptSnippets.EquationsText);
        }

        return blocks.Count == 0
            ? null
            : "# Response guidelines\n" + string.Join("\n\n", blocks);
    }

    // With no user (admin token counts) the header alone is emitted, so the count still
    // reflects that the section exists.
    private static string BuildAboutUser(PromptUserContext? user)
    {
        var builder = new StringBuilder("# About the user");
        if (user == null)
        {
            return builder.ToString();
        }

        AppendFact(builder, "Name", user.Name);
        AppendFact(builder, "Position", user.JobRole);
        AppendFact(builder, "Email", user.Email);
        return builder.ToString();
    }

    private static void AppendFact(StringBuilder builder, string label, string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length == 0)
        {
            return;
        }
        builder.Append('\n').Append("- ").Append(label).Append(": ").Append(trimmed);
    }

    private static string? BuildKnowledgeFiles(List<AssistantFile> files)
    {
        // Only always-loaded files go into the system message, and only their text
        // content — images cannot be carried in a system message.
        var builder = new StringBuilder();
        foreach (var file in files.Where(f => f.Category == AssistantFileCategories.AlwaysLoaded))
        {
            var text = string.Concat(file.Chunks
                .Where(chunk => chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                .Select(chunk => chunk.Text));

            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            builder.AppendLine();
            builder.AppendLine();
            builder.AppendLine($"## {file.SourceFilename}");
            builder.AppendLine(text);
        }

        return builder.Length == 0 ? null : "# Knowledge files" + builder;
    }
}
