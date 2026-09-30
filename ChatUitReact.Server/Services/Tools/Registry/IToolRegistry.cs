using System.Collections.Generic;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>Which tools exist. Server tools come from DI; client tools are built per message.</summary>
public interface IToolRegistry
{
    IReadOnlyList<ITool> ServerTools { get; }

    /// <summary>Finds a server tool by its id or one of its legacy ids.</summary>
    ITool? Find(string idOrLegacyId);

    /// <summary>Maps a legacy id to the current id. Unknown ids pass through unchanged.</summary>
    string Normalise(string idOrLegacyId);

    /// <summary>Resolves stored ids to tools, skipping unknown ones.</summary>
    IReadOnlyList<ITool> Resolve(IEnumerable<string> idsOrLegacyIds);

    /// <summary>
    /// Turns a message's client tool declarations into tools the model can call.
    /// Throws <see cref="ToolArgumentException"/> on a bad name or schema.
    /// </summary>
    IReadOnlyList<ITool> CreateClientTools(IEnumerable<ClientToolDeclarationDto> declarations);

    /// <summary>
    /// Turns a Responses request's function tools into client tools. Names follow the Responses
    /// rule and may not be one of <paramref name="serverToolIds"/>; the schema is optional.
    /// Throws <see cref="ClientToolDeclarationException"/> naming the refused declaration.
    /// </summary>
    IReadOnlyList<ITool> CreateResponsesClientTools(IReadOnlyList<ClientToolDeclaration> declarations, IReadOnlyCollection<string> serverToolIds);
}
