using System;
using System.Collections.Generic;

namespace ChatUiT.Server.Models;

/// <summary>One internal agent definition and the model an admin set for it.</summary>
public class InternalAgentAdminDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<ToolFunctionDto> Functions { get; set; } = new();
    /// <summary>Null when none is set: a nested run uses the chat's model, and the Responses API cannot use the agent.</summary>
    public string? ModelId { get; set; }
    public ReasoningEffort? ReasoningEffort { get; set; }
    /// <summary>Whether the Responses API serves the agent, under its id.</summary>
    public bool ExposedInApi { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>What the internal agent editor saves.</summary>
public class InternalAgentSettingDto
{
    /// <summary>The <c>Model.Id</c> of a function-calling model.</summary>
    public string ModelId { get; set; } = string.Empty;
    /// <summary>Clamped to what the model accepts.</summary>
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    /// <summary>Whether the Responses API serves the agent, under its id.</summary>
    public bool ExposedInApi { get; set; }
}
