using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models;

public class AssistantListDto
{
    public List<FullAssistantDto> Owned { get; set; } = new List<FullAssistantDto>();
    public List<AssistantSummaryDto> System { get; set; } = new List<AssistantSummaryDto>();
    public List<AssistantSummaryDto> Shared { get; set; } = new List<AssistantSummaryDto>();

    /// <summary>
    /// The assistant the user pinned, exactly as stored, or null. It is deliberately not
    /// filtered against eligibility: the client needs to tell "no pin" apart from "pinned but
    /// currently inactive" so it can explain the fallback instead of degrading silently.
    /// Check the pinned assistant's <c>CanBeDefault</c> to know which it is.
    /// </summary>
    public string? DefaultAssistantId { get; set; }
}

/// <summary>Who may use a system assistant. Null means everyone. Ignored on private assistants.</summary>
public class AssistantAccessPolicyDto
{
    public List<UserRole> AllowedRoles { get; set; } = new();
    public List<string> AllowedGroupIds { get; set; } = new();
}

public class FullAssistantDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    public string ModelId { get; set; } = string.Empty;

    /// <summary>The lowest classification of the model and the tools of the selected toolboxes. Set when reading an assistant.</summary>
    public DataClassification Classification { get; set; }
    public string SystemPrompt { get; set; } = string.Empty;
    public float Temperature { get; set; } = 0.7f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    public List<string> AvailableToolIds { get; set; } = new List<string>();
    public List<string> PromptSnippets { get; set; } = new List<string>();
    public bool IsVisible { get; set; }
    public bool IsFavorite { get; set; }

    /// <summary>
    /// Whether this user may pin this assistant as their default. False when the assistant's
    /// model is gone, is not available to this user's roles, or is not flagged
    /// <see cref="Model.AllowedAsDefault"/>. Computed server-side so the client never has to
    /// re-derive the rule from its role-filtered model list.
    /// </summary>
    public bool CanBeDefault { get; set; }

    /// <summary>System assistants only. Null means everyone.</summary>
    public AssistantAccessPolicyDto? Access { get; set; }

    public List<AssistantFileDto> Files { get; set; } = new List<AssistantFileDto>();

    public List<string> KnowledgeSourceIds { get; set; } = new List<string>();

    /// <summary>
    /// Per token counting scheme: the fixed cost every request through this assistant pays —
    /// system prompt with knowledge files appended, tool definitions, and reply priming.
    /// </summary>
    public Dictionary<string, int> PromptTokenCounts { get; set; } = new();

    /// <summary>Per scheme: the part of <see cref="PromptTokenCounts"/> the knowledge-files section adds.</summary>
    public Dictionary<string, int> KnowledgeTokenCounts { get; set; } = new();
}

public class AssistantFileDto
{
    // Empty for files that are new in a create/update request.
    public string? Id { get; set; }
    public string SourceFilename { get; set; } = string.Empty;
    public string Category { get; set; } = AssistantFileCategories.AlwaysLoaded;
    public string? Description { get; set; }
    // Full content for new files in create/update requests; when reading an
    // assistant the chunks carry metadata only (no text/base64) and content is
    // fetched separately. An already-stored file is kept as-is when its chunks
    // arrive without content.
    public List<ChatFileChunkDto> Chunks { get; set; } = new List<ChatFileChunkDto>();

    /// <summary>
    /// Per scheme: what the file costs as the message that carries it. Set when reading an
    /// assistant; ignored in create/update requests.
    /// </summary>
    public Dictionary<string, int> TokenCounts { get; set; } = new();
}

public class AssistantSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    public string ModelId { get; set; } = string.Empty;

    /// <summary>The lowest classification of the model and the tools of the selected toolboxes. Set when reading an assistant.</summary>
    public DataClassification Classification { get; set; }
    public bool IsVisible { get; set; }
    public bool IsFavorite { get; set; }

    /// <inheritdoc cref="FullAssistantDto.CanBeDefault"/>
    public bool CanBeDefault { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    /// <inheritdoc cref="FullAssistantDto.PromptTokenCounts"/>
    public Dictionary<string, int> PromptTokenCounts { get; set; } = new();

    /// <summary>Per scheme: the part of <see cref="PromptTokenCounts"/> the knowledge-files section adds.</summary>
    public Dictionary<string, int> KnowledgeTokenCounts { get; set; } = new();
}

public class CreateAssistantDto
{
    /// <summary>System assistants only; ignored on user endpoints. Null means everyone.</summary>
    public AssistantAccessPolicyDto? Access { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    [Required]
    public string ModelId { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public float Temperature { get; set; } = 0.7f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    public List<string> AvailableToolIds { get; set; } = new List<string>();
    public List<string> PromptSnippets { get; set; } = new List<string>();
    public List<AssistantFileDto> Files { get; set; } = new List<AssistantFileDto>();
    public List<string> KnowledgeSourceIds { get; set; } = new List<string>();
}

public class UpdateAssistantDto
{
    /// <summary>System assistants only; ignored on user endpoints. Null means everyone.</summary>
    public AssistantAccessPolicyDto? Access { get; set; }
    [Required]
    public string Id { get; set; } = string.Empty;
    [Required]
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    [Required]
    public string ModelId { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public float Temperature { get; set; } = 0.7f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    public List<string> AvailableToolIds { get; set; } = new List<string>();
    public List<string> PromptSnippets { get; set; } = new List<string>();
    public List<AssistantFileDto> Files { get; set; } = new List<AssistantFileDto>();
    public List<string> KnowledgeSourceIds { get; set; } = new List<string>();
}
