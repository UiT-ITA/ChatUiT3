using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;

namespace ChatUitReact.Server.Tests;

/// <summary>
/// The matrix that would have caught "'temperature' does not support 0.7 with this model",
/// plus the surrounding clamping rules. Model shapes here mirror real provider behaviour —
/// see ModelCatalog for where those values come from.
/// </summary>
public class ChatParameterResolverTests
{
    // gpt-5.4 / gpt-5.5: temperature only while reasoning is off, five effort levels.
    private static ModelCapabilities Gpt54() => new()
    {
        SupportsVision = true,
        SupportsFunctionCalling = true,
        Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
        SupportedEfforts = new List<ReasoningEffort>
        {
            ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium,
            ReasoningEffort.High, ReasoningEffort.XHigh
        },
        MaxContextTokens = 1_050_000,
        MaxOutputTokens = 128_000,
        DefaultMaxOutputTokens = 32_000
    };

    // gpt-4o: plain sampling model, no reasoning at all.
    private static ModelCapabilities Gpt4o() => new()
    {
        SupportsVision = true,
        SupportsFunctionCalling = true,
        Temperature = TemperatureSupport.Supported,
        SupportedEfforts = new List<ReasoningEffort>(),
        MaxContextTokens = 128_000,
        MaxOutputTokens = 16_384,
        DefaultMaxOutputTokens = 16_384
    };

    // claude-opus-5: rejects temperature outright, and always reasons.
    private static ModelCapabilities ClaudeOpus5() => new()
    {
        SupportsVision = true,
        SupportsFunctionCalling = true,
        Temperature = TemperatureSupport.Unsupported,
        SupportedEfforts = new List<ReasoningEffort>
        {
            ReasoningEffort.Low, ReasoningEffort.Medium,
            ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max
        },
        MaxContextTokens = 1_000_000,
        MaxOutputTokens = 128_000,
        DefaultMaxOutputTokens = 32_000
    };

    private static ChatSettings Settings(
        float temperature = 0.7f,
        ReasoningEffort effort = ReasoningEffort.None,
        List<string>? toolIds = null) => new()
    {
        Temperature = temperature,
        ReasoningEffort = effort,
        AvailableToolIds = toolIds ?? new List<string>()
    };

    [Fact]
    public void Gpt54_WithReasoningOff_SendsTemperature()
    {
        var result = ChatParameterResolver.Resolve(Gpt54(), Settings(effort: ReasoningEffort.None));

        Assert.Equal(0.7f, result.Temperature);
        Assert.Equal(ReasoningEffort.None, result.Effort);
    }

    [Theory]
    [InlineData(ReasoningEffort.Low)]
    [InlineData(ReasoningEffort.Medium)]
    [InlineData(ReasoningEffort.High)]
    [InlineData(ReasoningEffort.XHigh)]
    public void Gpt54_WithReasoningOn_OmitsTemperature(ReasoningEffort effort)
    {
        // The reported bug: this combination returned HTTP 400 from the API.
        var result = ChatParameterResolver.Resolve(Gpt54(), Settings(effort: effort));

        Assert.Null(result.Temperature);
        Assert.Equal(effort, result.Effort);
    }

    [Fact]
    public void Gpt4o_AlwaysSendsTemperature_AndNeverReasons()
    {
        var result = ChatParameterResolver.Resolve(Gpt4o(), Settings(effort: ReasoningEffort.High));

        Assert.Equal(0.7f, result.Temperature);
        Assert.Equal(ReasoningEffort.None, result.Effort);
        Assert.False(result.ReasoningActive);
    }

    [Fact]
    public void ClaudeOpus5_NeverSendsTemperature()
    {
        var result = ChatParameterResolver.Resolve(ClaudeOpus5(), Settings(effort: ReasoningEffort.None));

        Assert.Null(result.Temperature);
    }

    [Fact]
    public void AlwaysReasoningModel_ResolvesNoneUpToItsWeakestLevel()
    {
        // Opus 5 has no "off" switch, so asking for None must not silently disable
        // reasoning — it resolves to the lowest level the model actually offers.
        var result = ChatParameterResolver.Resolve(ClaudeOpus5(), Settings(effort: ReasoningEffort.None));

        Assert.Equal(ReasoningEffort.Low, result.Effort);
        Assert.True(result.ReasoningActive);
    }

    [Fact]
    public void EffortAboveModelCeiling_StepsDownToTheStrongestSupportedLevel()
    {
        var result = ChatParameterResolver.Resolve(Gpt54(), Settings(effort: ReasoningEffort.Max));

        Assert.Equal(ReasoningEffort.XHigh, result.Effort);
    }

    [Fact]
    public void MaxOutputTokens_IsAlwaysSet()
    {
        // Anthropic requires max_tokens on every request, so this may never be zero.
        foreach (var capabilities in new[] { Gpt54(), Gpt4o(), ClaudeOpus5() })
        {
            var result = ChatParameterResolver.Resolve(capabilities, Settings());
            Assert.True(result.MaxOutputTokens > 0);
        }
    }

    [Fact]
    public void MaxOutputTokens_IsClampedToTheModelCeiling()
    {
        var capabilities = Gpt4o();
        capabilities.DefaultMaxOutputTokens = 999_999;

        var result = ChatParameterResolver.Resolve(capabilities, Settings());

        Assert.Equal(capabilities.MaxOutputTokens, result.MaxOutputTokens);
    }

    [Fact]
    public void MaxOutputTokens_FallsBackWhenTheModelRowHasNoLimits()
    {
        var capabilities = Gpt4o();
        capabilities.MaxOutputTokens = 0;
        capabilities.DefaultMaxOutputTokens = 0;

        var result = ChatParameterResolver.Resolve(capabilities, Settings());

        Assert.True(result.MaxOutputTokens > 0);
    }

    [Fact]
    public void ToolsAreDropped_WhenTheModelCannotCallThem()
    {
        var capabilities = Gpt4o();
        capabilities.SupportsFunctionCalling = false;

        var result = ChatParameterResolver.Resolve(capabilities, Settings(toolIds: new List<string> { "web-search" }));

        Assert.Empty(result.ToolIds);
    }

    [Fact]
    public void ToolsArePassedThrough_WhenTheModelSupportsThem()
    {
        var result = ChatParameterResolver.Resolve(Gpt4o(), Settings(toolIds: new List<string> { "web-search" }));

        Assert.Equal(new[] { "web-search" }, result.ToolIds);
    }

    [Fact]
    public void ImagesAreBlocked_WhenTheModelHasNoVision()
    {
        var capabilities = Gpt4o();
        capabilities.SupportsVision = false;

        Assert.False(ChatParameterResolver.Resolve(capabilities, Settings()).AllowImages);
        Assert.True(ChatParameterResolver.Resolve(Gpt4o(), Settings()).AllowImages);
    }
}
