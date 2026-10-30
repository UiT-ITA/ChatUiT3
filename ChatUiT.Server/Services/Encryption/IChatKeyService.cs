namespace ChatUiT.Server.Services.Encryption;

/// <summary>
/// The per-user AES-256 keys that encrypt the content of red chats. Each key is a Key Vault
/// secret, created on first use.
/// </summary>
public interface IChatKeyService
{
    /// <summary>The user's key, created in Key Vault when the user has none.</summary>
    Task<byte[]> GetUserKeyAsync(string userId);
}
