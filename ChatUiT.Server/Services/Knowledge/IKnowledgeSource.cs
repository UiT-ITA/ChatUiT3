using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Knowledge;

/// <summary>
/// Background knowledge an assistant can carry that is produced at send time instead of
/// uploaded. The text goes to the model as a leading message, like a knowledge file, so the
/// model never has to call anything to see it. Adding a source is one class and one DI line:
/// the registry, the editor and the request pipeline pick it up from there.
/// </summary>
public interface IKnowledgeSource
{
    /// <summary>Stored on assistants. Matches <c>^[a-z][a-z0-9_]{0,63}$</c>.</summary>
    string Id { get; }

    /// <summary>Shown to people in the assistant editor and in the message lead line.</summary>
    string DisplayName { get; }

    /// <summary>Shown to people in the assistant editor.</summary>
    string Description { get; }

    /// <summary>Heading the editor groups sources under.</summary>
    string Group { get; }

    /// <summary>Who may add the source to an assistant and have it loaded.</summary>
    ToolAccessPolicy DefaultPolicy { get; }

    /// <summary>Delegated scopes the source acquires through <see cref="IUserTokenProvider"/>.</summary>
    IReadOnlyList<string> RequiredScopes => [];

    /// <summary>The text to carry, or null when there is nothing to say.</summary>
    Task<string?> LoadAsync(KnowledgeSourceContext context, CancellationToken cancellationToken);
}

/// <summary>What a source knows about the message it loads for.</summary>
public sealed class KnowledgeSourceContext
{
    /// <summary>The user, their access and their token provider, as tools get them.</summary>
    public required ToolExecutionContext Run { get; init; }

    /// <summary>The user's time zone, for anything that depends on "today".</summary>
    public required TimeZoneInfo TimeZone { get; init; }

    public required DateTimeOffset Now { get; init; }

    public DateTimeOffset LocalNow => TimeZoneInfo.ConvertTime(Now, TimeZone);

    public DateOnly Today => DateOnly.FromDateTime(LocalNow.DateTime);

    /// <summary>Local midnight at the start of <paramref name="day"/>, in UTC.</summary>
    public DateTime StartOfDayUtc(DateOnly day)
        => TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), TimeZone);

    public DateTimeOffset ToLocal(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, TimeZone);
}
