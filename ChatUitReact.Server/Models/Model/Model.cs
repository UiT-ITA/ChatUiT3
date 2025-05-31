using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class Model
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ModelName { get; set; } = string.Empty;
    public string EndpointId { get; set; } = string.Empty;
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}

public class ModelCapabilities
{
    public bool SupportsVision { get; set; } = false;
    public bool SupportsReasoning { get; set; } = false;
    public bool SupportsFunctionCalling { get; set; } = false;
    public int MaxContextLength { get; set; } = 16_000;
    public int MaxOutputLength { get; set; } = 16_000;
    public DateTime KnowledgeCutoff { get; set; } = DateTime.MinValue;
}
