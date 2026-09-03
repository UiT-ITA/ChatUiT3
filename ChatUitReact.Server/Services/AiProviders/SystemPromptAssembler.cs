using System.Text;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.AiProviders;

/// <summary>
/// Builds the system prompt exactly as it goes to the provider. Used both when sending and
/// when counting an assistant's fixed token cost, so the counted prompt is byte-identical
/// to the sent one.
/// </summary>
public static class SystemPromptAssembler
{
    public static string AppendKnowledgeFiles(string systemPrompt, List<AssistantFile> files)
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

        if (builder.Length == 0)
        {
            return systemPrompt;
        }

        var knowledgeSection = "# Knowledge files" + builder;
        return string.IsNullOrWhiteSpace(systemPrompt)
            ? knowledgeSection
            : $"{systemPrompt}\n\n{knowledgeSection}";
    }
}
