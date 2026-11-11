using Microsoft.Extensions.Caching.Memory;

namespace ChatUiT.Server.Services.OfficeSignIn;

/// <summary>
/// Holds the result of a browser sign-in for the Office add-in until its task pane collects it.
/// The sign-in page in the user's browser puts the authorization code (or the sign-in error) under
/// the sign-in id, and the task pane takes it once. Results expire after <see cref="Lifetime"/>.
/// </summary>
public sealed class OfficeSignInRelay : IDisposable
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    /// <summary>The most results held at once. Results beyond it are dropped.</summary>
    public const int MaxEntries = 1000;

    private readonly MemoryCache _results = new(new MemoryCacheOptions { SizeLimit = MaxEntries });

    /// <summary>Stores the result under the id. False when the id already has a result.</summary>
    public bool TryPut(string id, OfficeSignInResult result)
    {
        lock (_results)
        {
            if (_results.TryGetValue(id, out _))
            {
                return false;
            }

            _results.Set(id, result, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = Lifetime,
                Size = 1
            });
            return true;
        }
    }

    /// <summary>Removes and returns the result under the id, or null when there is none yet.</summary>
    public OfficeSignInResult? Take(string id)
    {
        lock (_results)
        {
            if (!_results.TryGetValue(id, out OfficeSignInResult? result))
            {
                return null;
            }

            _results.Remove(id);
            return result;
        }
    }

    public void Dispose() => _results.Dispose();
}

/// <summary>The authorization code of a browser sign-in, or the error Entra returned instead.</summary>
public sealed record OfficeSignInResult(string? Code, string? Error);
