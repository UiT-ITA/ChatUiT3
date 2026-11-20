using ChatUiT.Server.Models;

namespace ChatUiT.Server.Tests;

public class AssistantEffortTests
{
    private const ReasoningEffort None = ReasoningEffort.None;
    private const ReasoningEffort Low = ReasoningEffort.Low;
    private const ReasoningEffort Medium = ReasoningEffort.Medium;
    private const ReasoningEffort High = ReasoningEffort.High;
    private const ReasoningEffort XHigh = ReasoningEffort.XHigh;
    private const ReasoningEffort Max = ReasoningEffort.Max;

    private static LanguageModelCapabilities Ladder(params ReasoningEffort[] efforts) =>
        new() { SupportedEfforts = efforts.ToList() };

    [Fact]
    public void Efforts_UsesNoneForFastWhenReasoningCanBeTurnedOff()
    {
        Assert.Equal([None, Medium, High], Assistant.Efforts(Ladder(None, Low, Medium, High, XHigh, Max)));
    }

    [Fact]
    public void Efforts_UsesLowForFastWhenTheModelAlwaysReasons()
    {
        Assert.Equal([Low, Medium, High], Assistant.Efforts(Ladder(Low, Medium, High, XHigh, Max)));
    }

    [Fact]
    public void Efforts_IsEmptyForAModelThatDoesNotReason()
    {
        Assert.Empty(Assistant.Efforts(Ladder()));
    }

    [Theory]
    [InlineData(None, None)]
    [InlineData(Low, None)]
    [InlineData(Medium, Medium)]
    [InlineData(High, High)]
    [InlineData(XHigh, High)]
    [InlineData(Max, High)]
    public void NormalizeEffort_MapsEachLevelToItsTierWhenReasoningCanBeTurnedOff(ReasoningEffort requested, ReasoningEffort expected)
    {
        Assert.Equal(expected, Assistant.NormalizeEffort(Ladder(None, Low, Medium, High, XHigh, Max), requested));
    }

    [Theory]
    [InlineData(None, Low)]
    [InlineData(Low, Low)]
    [InlineData(Medium, Medium)]
    [InlineData(Max, High)]
    public void NormalizeEffort_MapsEachLevelToItsTierWhenTheModelAlwaysReasons(ReasoningEffort requested, ReasoningEffort expected)
    {
        Assert.Equal(expected, Assistant.NormalizeEffort(Ladder(Low, Medium, High, XHigh, Max), requested));
    }

    [Theory]
    [InlineData(None)]
    [InlineData(Medium)]
    [InlineData(Max)]
    public void NormalizeEffort_ReturnsNoneForAModelThatDoesNotReason(ReasoningEffort requested)
    {
        Assert.Equal(None, Assistant.NormalizeEffort(Ladder(), requested));
    }

    [Theory]
    [InlineData(None)]
    [InlineData(Medium)]
    [InlineData(Max)]
    public void NormalizeEffort_StepsUpToTheOnlyTierAModelHas(ReasoningEffort requested)
    {
        Assert.Equal(High, Assistant.NormalizeEffort(Ladder(High), requested));
    }

    [Fact]
    public void NormalizeEffort_StepsDownToTheNearestLowerTier()
    {
        Assert.Equal(None, Assistant.NormalizeEffort(Ladder(None, High), Medium));
        Assert.Equal(Medium, Assistant.NormalizeEffort(Ladder(None, Medium, XHigh), Max));
    }

    [Fact]
    public void NormalizeEffort_NeverReturnsALevelAboveHigh()
    {
        Assert.Equal(Low, Assistant.NormalizeEffort(Ladder(Low, XHigh, Max), Max));
    }
}
