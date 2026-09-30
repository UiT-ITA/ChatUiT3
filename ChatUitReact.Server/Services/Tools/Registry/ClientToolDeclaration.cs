using System.Text.Json;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>A client tool as a chat message or a Responses request declared it, before it is checked.</summary>
/// <param name="ParametersSchema">Null when the declaration has no schema.</param>
public sealed record ClientToolDeclaration(string Name, string? Description, JsonElement? ParametersSchema);

/// <summary>A client tool declaration was refused.</summary>
public sealed class ClientToolDeclarationException : ToolArgumentException
{
    public ClientToolDeclarationException(int? index, string field, string message) : base(message)
    {
        Index = index;
        Field = field;
    }

    /// <summary>The refused declaration's position, or null when the list as a whole was refused.</summary>
    public int? Index { get; }

    /// <summary>The field at fault: <c>name</c>, <c>description</c> or <c>parameters</c>.</summary>
    public string Field { get; }
}
