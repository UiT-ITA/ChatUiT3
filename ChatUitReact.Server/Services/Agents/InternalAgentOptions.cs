using System.Collections.Generic;

namespace ChatUitReact.Server.Services.Agents;

public sealed class InternalAgentOptions
{
    public const string SectionName = "InternalAgents";

    /// <summary>Agent id → <c>Model.Id</c> to run it on. An agent without an entry runs on the calling chat's model.</summary>
    public Dictionary<string, string> Models { get; set; } = new();
}
