using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using ChatUiT.Server.Models;
using Microsoft.Extensions.Logging;

namespace ChatUiT.Server.Services.Knowledge;

/// <summary>Which knowledge sources exist and which of them a user may use.</summary>
public interface IKnowledgeSourceRegistry
{
    IReadOnlyList<IKnowledgeSource> Sources { get; }

    IKnowledgeSource? Find(string id);

    /// <summary>The sources this user may use, in display order.</summary>
    IReadOnlyList<IKnowledgeSource> ForUser(UserAccess access);

    /// <summary>Stored ids to sources, skipping unknown ones.</summary>
    IReadOnlyList<IKnowledgeSource> Resolve(IEnumerable<string> ids);

    /// <summary>Stored ids to sources this user may use, skipping unknown and disallowed ones.</summary>
    IReadOnlyList<IKnowledgeSource> ResolveAllowed(IEnumerable<string> ids, UserAccess access);

    /// <summary>Ids that name no source, and ids this user may not use.</summary>
    KnowledgeSourceIdCheck Check(IEnumerable<string> ids, UserAccess access);
}

public sealed record KnowledgeSourceIdCheck(IReadOnlyList<string> Unknown, IReadOnlyList<string> Disallowed)
{
    public bool Ok => Unknown.Count == 0 && Disallowed.Count == 0;
}

public sealed partial class KnowledgeSourceRegistry : IKnowledgeSourceRegistry
{
    [GeneratedRegex("^[a-z][a-z0-9_]{0,63}$")]
    private static partial Regex IdPattern();

    private readonly Dictionary<string, IKnowledgeSource> _byId = new(StringComparer.Ordinal);

    public KnowledgeSourceRegistry(IEnumerable<IKnowledgeSource> sources, ILogger<KnowledgeSourceRegistry> logger)
    {
        foreach (var source in sources)
        {
            if (!IdPattern().IsMatch(source.Id))
            {
                throw new InvalidOperationException(
                    $"Knowledge source id '{source.Id}' ({source.GetType().Name}) must match ^[a-z][a-z0-9_]{{0,63}}$.");
            }

            if (!_byId.TryAdd(source.Id, source))
            {
                throw new InvalidOperationException($"Knowledge source id '{source.Id}' is registered twice.");
            }
        }

        Sources = _byId.Values
            .OrderBy(s => s.Group, StringComparer.OrdinalIgnoreCase)
            .ThenBy(s => s.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
        logger.LogInformation("Registered {Count} knowledge sources: {Ids}", Sources.Count, string.Join(", ", Sources.Select(s => s.Id)));
    }

    public IReadOnlyList<IKnowledgeSource> Sources { get; }

    public IKnowledgeSource? Find(string id)
        => id != null && _byId.TryGetValue(id, out var source) ? source : null;

    public IReadOnlyList<IKnowledgeSource> ForUser(UserAccess access)
        => Sources.Where(s => s.DefaultPolicy.Allows(access)).ToList();

    public IReadOnlyList<IKnowledgeSource> Resolve(IEnumerable<string> ids)
        => (ids ?? [])
            .Distinct(StringComparer.Ordinal)
            .Select(Find)
            .OfType<IKnowledgeSource>()
            .ToList();

    public IReadOnlyList<IKnowledgeSource> ResolveAllowed(IEnumerable<string> ids, UserAccess access)
        => Resolve(ids).Where(s => s.DefaultPolicy.Allows(access)).ToList();

    public KnowledgeSourceIdCheck Check(IEnumerable<string> ids, UserAccess access)
    {
        var unknown = new List<string>();
        var disallowed = new List<string>();

        foreach (var id in (ids ?? []).Distinct(StringComparer.Ordinal))
        {
            var source = Find(id);
            if (source == null)
            {
                unknown.Add(id);
            }
            else if (!source.DefaultPolicy.Allows(access))
            {
                disallowed.Add(id);
            }
        }

        return new KnowledgeSourceIdCheck(unknown, disallowed);
    }
}
