using Anthropic.Models.Messages;
using ChatUitReact.Server.Models;
using DomainModel = ChatUitReact.Server.Models.Model;
using ChatUitReact.Server.Services.AiProviders;
using Microsoft.Extensions.Logging.Abstractions;

namespace ChatUitReact.Server.Tests;

/// <summary>
/// Anthropic requires a leading user turn and strictly alternating roles. Our stored chats
/// break both rules — a failed generation or a regenerate leaves consecutive assistant
/// messages — and the API answers with a 400, so the normalisation is worth pinning down.
/// </summary>
public class AnthropicMessageNormalizationTests
{
    [Fact]
    public void ConsecutiveAssistantMessages_AreMergedIntoOneTurn()
    {
        var messages = Normalize(
            User("Hi"),
            Assistant("Partial answer"),
            Assistant("...continued"));

        Assert.Equal(2, messages.Count);
        Assert.Equal("user", RoleName(messages[0]));
        Assert.Equal("assistant", RoleName(messages[1]));
    }

    [Fact]
    public void ALeadingAssistantMessage_IsDropped()
    {
        var messages = Normalize(
            Assistant("Orphaned greeting"),
            User("Hi"));

        Assert.Single(messages);
        Assert.Equal("user", RoleName(messages[0]));
    }

    [Fact]
    public void RolesAlternate_AfterNormalization()
    {
        var messages = Normalize(
            Assistant("dropped"),
            User("a"),
            User("b"),
            Assistant("c"),
            Assistant("d"),
            User("e"));

        Assert.Equal(
            new[] { "user", "assistant", "user" },
            messages.Select(RoleName));
    }

    [Fact]
    public void ASystemMessage_IsFoldedIntoTheUserTurn()
    {
        // Anthropic takes the system prompt as a top-level parameter and has no
        // mid-conversation system role, so such a message must not be dropped silently.
        var messages = Normalize(
            new ChatMessage { Role = AiChatRole.System, Content = "Context" },
            User("Question"));

        Assert.Single(messages);
        Assert.Equal("user", RoleName(messages[0]));
    }

    [Fact]
    public void AnEmptyConversation_StillProducesALeadingUserTurn()
    {
        // An empty Messages array is rejected by the API.
        var messages = Normalize();

        Assert.Single(messages);
        Assert.Equal("user", RoleName(messages[0]));
    }

    [Fact]
    public void EmptyMessages_AreSkippedRatherThanSentAsBlankTurns()
    {
        var messages = Normalize(
            User("Hi"),
            Assistant(string.Empty),
            User("Still there?"));

        // The blank assistant turn disappears, so the two user turns merge into one.
        Assert.Single(messages);
        Assert.Equal("user", RoleName(messages[0]));
    }

    // Role is an ApiEnum whose ToString renders the JSON value, quotes included.
    private static string RoleName(MessageParam message) => message.Role.ToString()!.Trim('"');

    private static ChatMessage User(string content) =>
        new() { Role = AiChatRole.User, Content = content };

    private static ChatMessage Assistant(string content) =>
        new() { Role = AiChatRole.Assistant, Content = content };

    private static List<MessageParam> Normalize(params ChatMessage[] messages)
    {
        var provider = new AnthropicProvider(NullLogger<AnthropicProvider>.Instance);

        return provider.BuildMessages(new AiRequest
        {
            Model = new DomainModel { ModelId = "claude-opus-5" },
            Endpoint = new ModelEndpoint { EndpointType = EndpointType.Anthropic },
            Messages = messages,
            Parameters = new ResolvedChatParameters { MaxOutputTokens = 1000 }
        });
    }
}
