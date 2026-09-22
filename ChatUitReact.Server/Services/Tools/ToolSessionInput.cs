using System.Collections.Generic;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// What the request boundary knows about the caller that the background generation needs
/// for tools: their access, a way to get downstream tokens on their behalf, and the client
/// tools they offered for this message.
/// </summary>
public sealed class ToolSessionInput
{
    public required UserAccess Access { get; init; }

    public required IUserTokenProvider Tokens { get; init; }

    public IReadOnlyList<ClientToolDeclarationDto> ClientTools { get; init; } = [];

    /// <summary>Who the caller is, for tools that act on their behalf and must recognise them by name.</summary>
    public string? UserDisplayName { get; init; }

    public string? UserPrincipalName { get; init; }

    /// <summary>For callers without a principal: baseline role, no groups, no delegated tokens.</summary>
    public static readonly ToolSessionInput Anonymous = new()
    {
        Access = new UserAccess([UserRole.User], []),
        Tokens = NoUserTokenProvider.Instance
    };
}
