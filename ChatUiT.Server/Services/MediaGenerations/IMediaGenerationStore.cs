using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Services.MediaGenerations;

using ChatUiT.Server.Models;

/// <summary>Where a user's generations and their outputs are kept.</summary>
public interface IMediaGenerationStore
{
    /// <summary>Adds a generation when its run starts.</summary>
    void Add(MediaGeneration generation);

    /// <summary>Called once the run has finished, whatever the outcome.</summary>
    void Finish(MediaGeneration generation);

    /// <summary>Null when the user has no generation with the id.</summary>
    MediaGeneration? Get(string userId, string generationId);

    /// <summary>The user's generations, newest first.</summary>
    IReadOnlyList<MediaGeneration> List(string userId);
}

/// <summary>
/// Keeps generations in memory only, for <see cref="Retention"/> after their run finishes. A
/// restart loses them.
/// </summary>
public sealed class InMemoryMediaGenerationStore : IMediaGenerationStore
{
    public static readonly TimeSpan Retention = TimeSpan.FromMinutes(5);

    private readonly ConcurrentDictionary<string, MediaGeneration> _generations = new();

    public void Add(MediaGeneration generation) => _generations[Key(generation.UserId, generation.Id)] = generation;

    public void Finish(MediaGeneration generation)
    {
        var key = Key(generation.UserId, generation.Id);
        _ = Task.Run(async () =>
        {
            await Task.Delay(Retention);
            _generations.TryRemove(key, out _);
        });
    }

    public MediaGeneration? Get(string userId, string generationId) =>
        _generations.TryGetValue(Key(userId, generationId), out var generation) ? generation : null;

    public IReadOnlyList<MediaGeneration> List(string userId) =>
        _generations.Values
            .Where(g => g.UserId == userId)
            .OrderByDescending(g => g.CreatedAt)
            .ToList();

    private static string Key(string userId, string generationId) => $"{userId}:{generationId}";
}
