using System.Text;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.AiProviders;

/// <summary>
/// Builds the system prompt exactly as it goes to the provider. Used both when sending and
/// when counting an assistant's fixed token cost, so the counted prompt is byte-identical
/// to the sent one.
///
/// Order: the owner's instructions under their own header, then one section per enabled
/// snippet group, then the list of on-demand files. Every section has an H1 header so the
/// prompt reads as one document wherever the provider places it. File content is not part of
/// the prompt; <see cref="KnowledgeFileMessages"/> carries it as messages.
/// </summary>
public static class SystemPromptAssembler
{
    /// <param name="loadedFileIds">On-demand files pinned to the chat; they are left out of the on-demand list.</param>
    /// <param name="canLoadOnDemand">Whether the model can call the load tool. Without it the on-demand list is left out.</param>
    public static string Build(
        string systemPrompt,
        IReadOnlyList<string> snippetIds,
        PromptUserContext? user,
        List<AssistantFile> files,
        IReadOnlySet<string> loadedFileIds,
        bool canLoadOnDemand)
    {
        var sections = new List<string>();

        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            sections.Add("# Assistant instructions\n" + systemPrompt.Trim());
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

        if (canLoadOnDemand)
        {
            var onDemand = BuildOnDemandFiles(files, loadedFileIds);
            if (onDemand != null)
            {
                sections.Add(onDemand);
            }
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

    // Pinned files are already carried as messages and are not mentioned here at all.
    private static string? BuildOnDemandFiles(List<AssistantFile> files, IReadOnlySet<string> loadedFileIds)
    {
        var available = KnowledgeFileMessages.Loadable(files, loadedFileIds);
        if (available.Count == 0)
        {
            return null;
        }

        var builder = new StringBuilder("# On-demand knowledge files\n");
        builder.Append("These files are not loaded. When one is relevant, call `").Append(LoadKnowledgeFileTool.ToolId).Append("` with its id. ");
        builder.Append("Use mode \"temporary\" for a one-off lookup and \"permanent\" to keep the file in context for the rest of the conversation. ");
        builder.Append("Long files come in parts; pass the returned `nextOffset` as `offset` to continue.");
        foreach (var file in available)
        {
            var description = file.Description?.Trim();
            builder.Append('\n').Append("- ").Append(file.SourceFilename).Append(" (id: ").Append(file.Id).Append(')');
            if (!string.IsNullOrEmpty(description))
            {
                builder.Append(": ").Append(description);
            }
        }

        return builder.ToString();
    }
}
