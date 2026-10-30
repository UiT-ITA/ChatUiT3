using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Azure;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

namespace ChatUiT.Server.Services.Encryption;

/// <summary>
/// Reads and creates the per-user keys in the Key Vault at KeyVault:Uri. A key is read from
/// the vault once per process and then held in memory.
/// </summary>
public sealed class ChatKeyService : IChatKeyService
{
    private const int KeySizeBytes = 32;

    private readonly SecretClient? _client;
    private readonly ConcurrentDictionary<string, Lazy<Task<byte[]>>> _keys = new();

    public ChatKeyService(IConfiguration configuration)
    {
        var vaultUri = configuration["KeyVault:Uri"];
        if (!string.IsNullOrWhiteSpace(vaultUri))
        {
            _client = new SecretClient(new Uri(vaultUri), new DefaultAzureCredential());
        }
    }

    public async Task<byte[]> GetUserKeyAsync(string userId)
    {
        var entry = _keys.GetOrAdd(userId, id => new Lazy<Task<byte[]>>(() => LoadOrCreateKeyAsync(id)));
        try
        {
            return await entry.Value;
        }
        catch
        {
            _keys.TryRemove(new KeyValuePair<string, Lazy<Task<byte[]>>>(userId, entry));
            throw;
        }
    }

    private async Task<byte[]> LoadOrCreateKeyAsync(string userId)
    {
        if (_client == null)
        {
            throw new InvalidOperationException("Chat encryption is not configured. Set KeyVault:Uri.");
        }

        var name = SecretName(userId);
        var version = await OldestVersionAsync(name);
        if (version == null)
        {
            await _client.SetSecretAsync(name, Convert.ToBase64String(RandomNumberGenerator.GetBytes(KeySizeBytes)));
            // Concurrent creations each add a version; all of them read the oldest one.
            version = await OldestVersionAsync(name)
                ?? throw new InvalidOperationException($"Key Vault secret {name} has no enabled version after it was created.");
        }

        var secret = await _client.GetSecretAsync(name, version);
        return Convert.FromBase64String(secret.Value.Value);
    }

    private async Task<string?> OldestVersionAsync(string name)
    {
        SecretProperties? oldest = null;
        try
        {
            await foreach (var properties in _client!.GetPropertiesOfSecretVersionsAsync(name))
            {
                if (properties.Enabled == true && (oldest == null || IsOlder(properties, oldest)))
                {
                    oldest = properties;
                }
            }
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
        }

        return oldest?.Version;
    }

    // CreatedOn has one-second precision; the version id orders versions created in the same second.
    private static bool IsOlder(SecretProperties candidate, SecretProperties current)
        => candidate.CreatedOn < current.CreatedOn ||
           (candidate.CreatedOn == current.CreatedOn && string.CompareOrdinal(candidate.Version, current.Version) < 0);

    // Secret names allow only letters, digits and dashes, and user ids are UPNs.
    private static string SecretName(string userId)
        => "chat-key-" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(userId)));
}
