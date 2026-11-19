using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.TokenCounting;

namespace ChatUiT.Server.Tests;

/// <summary>Checks that a history keeps only its newest images.</summary>
public class ImageLimitTests
{
    [Fact]
    public void History_within_the_limit_is_returned_as_is()
    {
        var items = new List<AiInputItem> { Result("a", 2), Result("b", 3) };

        Assert.Same(items, ImageLimit.KeepNewest(items, 5));
    }

    [Fact]
    public void Oldest_tool_result_images_are_replaced_by_the_note()
    {
        var items = new List<AiInputItem> { Result("a", 3), Result("b", 3), Result("c", 3) };

        var kept = ImageLimit.KeepNewest(items, 5);

        var a = Assert.IsType<AiInputItem.ToolResult>(kept[0]);
        var b = Assert.IsType<AiInputItem.ToolResult>(kept[1]);
        var c = Assert.IsType<AiInputItem.ToolResult>(kept[2]);
        Assert.Null(a.Images);
        Assert.Equal(3, Count(a.Content, ImageLimit.RemovedText(5)));
        Assert.Equal(new[] { "b2", "b3" }, b.Images!.Select(i => i.Base64));
        Assert.Equal(1, Count(b.Content, ImageLimit.RemovedText(5)));
        Assert.Same(items[2], c);
    }

    [Fact]
    public void Oldest_attached_images_are_replaced_and_the_original_is_unchanged()
    {
        var message = new ChatMessage
        {
            Content = "look",
            Files = new List<ChatFile>
            {
                new() { SourceFilename = "x.pdf", Chunks = new List<ChatFileChunk> { Image("x1"), Text("page"), Image("x2") } },
            },
        };
        var items = new List<AiInputItem> { new AiInputItem.Message(message), Result("a", 1) };

        var kept = ImageLimit.KeepNewest(items, 2);

        var copy = Assert.IsType<AiInputItem.Message>(kept[0]).Value;
        var chunks = copy.Files.Single().Chunks;
        Assert.Equal("text", chunks[0].Type);
        Assert.Equal(ImageLimit.RemovedText(2), chunks[0].Text);
        Assert.Equal("page", chunks[1].Text);
        Assert.Equal("x2", chunks[2].Base64);
        Assert.Equal("image", message.Files.Single().Chunks[0].Type);
        Assert.Equal("look", copy.Content);
        Assert.Same(items[1], kept[1]);
    }

    private static AiInputItem.ToolResult Result(string id, int images)
        => new(id, "text", false, Enumerable.Range(1, images).Select(i => new ImagePart($"{id}{i}", "image/png")).ToList());

    private static ChatFileChunk Image(string base64) => new() { Type = "image", Base64 = base64, Format = "png" };

    private static ChatFileChunk Text(string text) => new() { Type = "text", Text = text };

    private static int Count(string text, string part) => (text.Length - text.Replace(part, string.Empty).Length) / part.Length;
}
