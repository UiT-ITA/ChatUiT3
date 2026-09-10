using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ChatUitReact.Server.Services.AiProviders.Protocols;

/// <summary>
/// Separates <c>&lt;think&gt;…&lt;/think&gt;</c> reasoning from answer text in a stream of
/// content deltas. Some Chat Completions hosts return DeepSeek's chain of thought inline in
/// <c>content</c> this way instead of in a <c>reasoning_content</c> field. A tag can be cut
/// across two deltas, so a trailing fragment that could still become a tag is held back
/// until the next delta (or <see cref="Flush"/>) decides.
/// </summary>
internal sealed class ThinkTagSplitter
{
    private const string OpenTag = "<think>";
    private const string CloseTag = "</think>";

    private readonly StringBuilder _pending = new();
    private bool _inThink;

    public readonly record struct Piece(string Text, bool IsThinking);

    public IReadOnlyList<Piece> Push(string text)
    {
        _pending.Append(text);
        return Drain(final: false);
    }

    /// <summary>Releases whatever was held back as a possible partial tag.</summary>
    public IReadOnlyList<Piece> Flush() => Drain(final: true);

    /// <summary>The answer text only, with every think block removed.</summary>
    public static string StripThinkBlocks(string text)
    {
        var splitter = new ThinkTagSplitter();
        var pieces = splitter.Push(text).Concat(splitter.Flush());
        return string.Concat(pieces.Where(p => !p.IsThinking).Select(p => p.Text));
    }

    private List<Piece> Drain(bool final)
    {
        var pieces = new List<Piece>();
        var buffer = _pending.ToString();
        _pending.Clear();

        var position = 0;
        while (position < buffer.Length)
        {
            var tag = _inThink ? CloseTag : OpenTag;
            var index = buffer.IndexOf(tag, position, StringComparison.Ordinal);
            if (index >= 0)
            {
                if (index > position)
                {
                    pieces.Add(new Piece(buffer[position..index], _inThink));
                }

                _inThink = !_inThink;
                position = index + tag.Length;
                continue;
            }

            // No complete tag left. Everything is releasable except a tail that is the start
            // of the tag we are waiting for.
            var held = final ? 0 : PartialTagLength(buffer, position, tag);
            var end = buffer.Length - held;
            if (end > position)
            {
                pieces.Add(new Piece(buffer[position..end], _inThink));
            }

            if (held > 0)
            {
                _pending.Append(buffer, end, held);
            }

            break;
        }

        return pieces;
    }

    /// <summary>Length of the longest tail of the buffer that is a proper prefix of the tag.</summary>
    private static int PartialTagLength(string buffer, int position, string tag)
    {
        var longest = Math.Min(tag.Length - 1, buffer.Length - position);
        for (var length = longest; length > 0; length--)
        {
            if (string.CompareOrdinal(buffer, buffer.Length - length, tag, 0, length) == 0)
            {
                return length;
            }
        }

        return 0;
    }
}
