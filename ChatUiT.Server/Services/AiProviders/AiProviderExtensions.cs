using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ChatUiT.Server.Services.AiProviders;

public static class AiProviderExtensions
{
    /// <summary>Runs one turn of <paramref name="request"/> without tool calls and returns its text, trimmed.</summary>
    public static async Task<string> CompleteTextAsync(this IAiProvider provider, AiRequest request, CancellationToken cancellationToken = default)
    {
        var text = new StringBuilder();
        var conversation = provider.StartConversation(request);
        await foreach (var streamEvent in conversation.StreamTurnAsync(allowToolCalls: false, cancellationToken))
        {
            if (streamEvent is AiStreamEvent.Text textEvent)
            {
                text.Append(textEvent.Delta);
            }
        }

        return text.ToString().Trim();
    }
}
