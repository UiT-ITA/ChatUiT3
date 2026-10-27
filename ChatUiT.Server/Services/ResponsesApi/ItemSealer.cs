using System;
using System.Security.Cryptography;
using System.Text.Json;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.Tools;
using Microsoft.AspNetCore.DataProtection;

namespace ChatUiT.Server.Services.ResponsesApi;

/// <summary>
/// What an approval request carries through the client and back: enough to execute or commit
/// the call on a later request. <see cref="CatalogId"/> ties it to the catalog entry that asked.
/// </summary>
public sealed record ApprovalState(
    string CatalogId,
    string CallId,
    string Tool,
    string ArgumentsJson,
    bool AllowEdit);

/// <summary>
/// Seals the items a client must hand back unchanged and must not be able to fabricate:
/// reasoning state goes to the provider as trusted assistant state, and an approval id makes
/// the server execute or commit a tool. Both are protected with ASP.NET Core Data Protection;
/// a sealed value that was altered, or sealed under another key ring, does not open.
/// </summary>
public sealed class ItemSealer
{
    private const string Purpose = "ChatUiT.ResponsesApi";
    private const string ReasoningTag = "reasoning";
    private const string ApprovalTag = "approval";
    private const string ApprovalIdPrefix = "mcpr_";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IDataProtector _protector;

    public ItemSealer(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector(Purpose);
    }

    public string SealReasoning(ApiProtocol protocol, string modelId, JsonElement payload)
        => _protector.Protect(JsonSerializer.Serialize(new SealedReasoning(ReasoningTag, protocol, modelId, payload), Json));

    /// <summary>Null when the value does not open; the caller drops the item.</summary>
    public AiInputItem.ReasoningState? UnsealReasoning(string? sealedValue)
    {
        var sealedReasoning = Open<SealedReasoning>(sealedValue);
        return sealedReasoning is { Tag: ReasoningTag }
            ? new AiInputItem.ReasoningState(sealedReasoning.Protocol, sealedReasoning.ModelId, sealedReasoning.Payload)
            : null;
    }

    public string SealApproval(ApprovalState state)
        => ApprovalIdPrefix + _protector.Protect(JsonSerializer.Serialize(new SealedApproval(ApprovalTag, state), Json));

    /// <summary>Null when the id does not open.</summary>
    public ApprovalState? UnsealApproval(string? approvalId)
    {
        if (approvalId == null || !approvalId.StartsWith(ApprovalIdPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        var sealedApproval = Open<SealedApproval>(approvalId[ApprovalIdPrefix.Length..]);
        return sealedApproval is { Tag: ApprovalTag } ? sealedApproval.State : null;
    }

    private T? Open<T>(string? sealedValue) where T : class
    {
        if (string.IsNullOrEmpty(sealedValue))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(_protector.Unprotect(sealedValue), Json);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException or JsonException)
        {
            return null;
        }
    }

    private sealed record SealedReasoning(string Tag, ApiProtocol Protocol, string ModelId, JsonElement Payload);

    private sealed record SealedApproval(string Tag, ApprovalState State);
}
