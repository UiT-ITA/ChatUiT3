using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace ChatUiT.Server.Models;

/// <summary>What the assistant editor and the admin panel both show of a toolbox.</summary>
public abstract class ToolSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool RequiresConfirmation { get; set; }
    public List<string> RequiredScopes { get; set; } = new();
    public ToolExecution Execution { get; set; } = ToolExecution.Server;

    /// <summary>The lowest classification of the toolbox's own functions. Children carry their own.</summary>
    public DataClassification Classification { get; set; }
}

/// <summary>A tool as the assistant editor sees it: only tools and child toolboxes the caller may use are listed.</summary>
public class ToolDto : ToolSummaryDto
{
    public List<ToolDto> Children { get; set; } = new();
}

public class ToolAccessPolicyDto
{
    public bool Enabled { get; set; } = true;
    public List<UserRole> AllowedRoles { get; set; } = new();
    public List<string> AllowedGroupIds { get; set; } = new();
}

/// <summary>A tool as the admin panel sees it, with its code default and the effective policy.</summary>
public class ToolAdminDto : ToolSummaryDto
{
    /// <summary>The toolbox that holds this one as a child. Null for a top-level toolbox.</summary>
    public string? ParentId { get; set; }
    public JsonElement? ParametersSchema { get; set; }
    public ToolAccessPolicyDto DefaultPolicy { get; set; } = new();
    public ToolAccessPolicyDto Policy { get; set; } = new();
    public bool IsOverridden { get; set; }
    public DateTime? UpdatedAt { get; set; }
    /// <summary>Toolboxes of more than one tool: the functions the toolbox holds.</summary>
    public List<ToolFunctionDto>? Functions { get; set; }
}

/// <summary>One function of a toolbox, for display in the admin panel.</summary>
public class ToolFunctionDto
{
    public string Id { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool RequiresConfirmation { get; set; }
    public List<string> RequiredScopes { get; set; } = new();
    public DataClassification Classification { get; set; }
}

/// <summary>A tool the client offers to run itself for this message.</summary>
public class ClientToolDeclarationDto
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    /// <summary>A JSON Schema object describing the arguments.</summary>
    public JsonElement ParametersSchema { get; set; }
}

/// <summary>
/// The user's or client's answer to a tool call that waits. Kept on the call's activity entry
/// until the run that continues the message has used it.
/// </summary>
public class ToolCallResponseDto
{
    [Required]
    public ToolCallResponseKind Kind { get; set; }

    /// <summary>Confirmation: Approve or Reject. ClientResult: Reject when the user declined the call in the client.</summary>
    public ToolCallDecision? Decision { get; set; }

    /// <summary>Confirmation only: the arguments as edited by the user, when editing is allowed.</summary>
    public string? EditedArgumentsJson { get; set; }

    /// <summary>Answer only: one per question, null for a question the user skipped. Null when the user answered none.</summary>
    public List<UserAnswerDto?>? Answers { get; set; }

    /// <summary>ClientResult only.</summary>
    public string? Result { get; set; }

    public bool IsError { get; set; }
}

/// <summary>An answer to one call a message waits on, given with a new message instead of on its own.</summary>
public class PendingAnswerDto
{
    [Required]
    public string ToolCallId { get; set; } = string.Empty;

    [Required]
    public ToolCallResponseDto Response { get; set; } = new();
}

/// <summary>An answer to a tool call, plus what the run that continues the message needs from this request.</summary>
public class RespondToToolCallDto : ToolCallResponseDto
{
    public List<ClientToolDeclarationDto>? ClientTools { get; set; }

    /// <summary>The caller's IANA time zone.</summary>
    public string? TimeZone { get; set; }
}

public class ToolCallResponseResultDto
{
    public bool Accepted { get; set; }

    /// <summary>True when this was the last answer the message waited for and the message continues.</summary>
    public bool Continued { get; set; }
}

/// <summary>A question the model asks the user, with the answers to choose from.</summary>
public class UserQuestionDto
{
    public string Question { get; set; } = string.Empty;

    public List<UserQuestionOptionDto> Options { get; set; } = new();

    public bool MultiSelect { get; set; }
}

public class UserQuestionOptionDto
{
    public string Label { get; set; } = string.Empty;

    public string? Description { get; set; }
}

/// <summary>The options the user picked, by label, and what they wrote themselves.</summary>
public class UserAnswerDto
{
    public List<string> Selected { get; set; } = new();

    public string? Text { get; set; }
}
