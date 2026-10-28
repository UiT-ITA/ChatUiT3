using System;
using System.Collections.Generic;
using System.Linq;
using DocumentFormat.OpenXml;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>
/// Text of a paragraph spread over runs. An atom is one text element, or a tab or break that
/// counts as one character. Replacing keeps the formatting of the runs the text is in.
/// </summary>
internal static class RunText
{
    public static string Of(OpenXmlElement atom) => atom switch
    {
        OpenXmlLeafTextElement text => text.Text,
        W.TabChar => "\t",
        _ => "\n"
    };

    public static string Join(IEnumerable<OpenXmlElement> atoms) => string.Concat(atoms.Select(Of));

    /// <summary>Start offsets of every non-overlapping occurrence of <paramref name="find"/> in <paramref name="text"/>.</summary>
    public static List<int> Matches(string text, string find)
    {
        var starts = new List<int>();
        var from = 0;
        while (from <= text.Length - find.Length)
        {
            var start = text.IndexOf(find, from, StringComparison.Ordinal);
            if (start < 0)
            {
                break;
            }

            starts.Add(start);
            from = start + find.Length;
        }

        return starts;
    }

    /// <summary>
    /// Replaces every occurrence of <paramref name="find"/>, reading the atoms again after each
    /// replacement. Returns the number of replacements.
    /// </summary>
    public static int ReplaceAll(Func<List<OpenXmlElement>> atoms, string find, string replace, Action<OpenXmlElement, string> insertTextBefore)
    {
        var count = 0;
        var from = 0;
        while (true)
        {
            var current = atoms();
            var text = Join(current);
            var start = from <= text.Length ? text.IndexOf(find, from, StringComparison.Ordinal) : -1;
            if (start < 0)
            {
                return count;
            }

            Replace(current, start, find.Length, replace, insertTextBefore);
            count++;
            from = start + replace.Length;
        }
    }

    /// <summary>
    /// Replaces the characters from <paramref name="start"/> to <paramref name="start"/> + <paramref name="length"/>.
    /// The replacement goes into the first atom the range touches and the range is cut from the others.
    /// A tab or break inside the range is removed.
    /// </summary>
    public static void Replace(List<OpenXmlElement> atoms, int start, int length, string replace, Action<OpenXmlElement, string> insertTextBefore)
    {
        var end = start + length;
        var offset = 0;
        var placed = false;

        foreach (var atom in atoms)
        {
            var value = Of(atom);
            var atomStart = offset;
            var atomEnd = offset + value.Length;
            offset = atomEnd;

            if (atomEnd <= start || atomStart >= end)
            {
                continue;
            }

            if (atom is OpenXmlLeafTextElement text)
            {
                var before = start > atomStart ? value[..(start - atomStart)] : string.Empty;
                var after = end < atomEnd ? value[(end - atomStart)..] : string.Empty;
                text.Text = before + (placed ? string.Empty : replace) + after;
                if (text is W.Text wordText)
                {
                    wordText.Space = SpaceProcessingModeValues.Preserve;
                }
            }
            else
            {
                if (!placed && replace.Length > 0)
                {
                    insertTextBefore(atom, replace);
                }

                atom.Remove();
            }

            placed = true;
        }
    }

    /// <summary>Cuts <paramref name="text"/> to <paramref name="max"/> characters for a summary line.</summary>
    public static string Short(string text, int max = 120)
    {
        var flat = text.Replace("\n", "\\n");
        return flat.Length > max ? flat[..max] + "…" : flat;
    }
}
