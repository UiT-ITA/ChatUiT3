using System;
using System.Text;
using System.Text.RegularExpressions;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>A1-style cell and range addresses. Columns and rows are numbered from 1.</summary>
internal readonly record struct CellRange(int FirstColumn, int FirstRow, int LastColumn, int LastRow)
{
    private static readonly Regex Cell = new(@"^\$?([A-Za-z]{1,3})\$?([0-9]{1,7})$", RegexOptions.Compiled);

    public int Columns => LastColumn - FirstColumn + 1;

    public int Rows => LastRow - FirstRow + 1;

    public long Cells => (long)Rows * Columns;

    public bool IsSingleCell => Columns == 1 && Rows == 1;

    /// <summary>Parses "B2" or "B2:D10", with or without a "Sheet!" prefix. Whole columns or rows do not parse.</summary>
    public static bool TryParse(string? address, out CellRange range)
    {
        range = default;
        if (string.IsNullOrWhiteSpace(address))
        {
            return false;
        }

        var local = address.Trim();
        var bang = local.LastIndexOf('!');
        if (bang >= 0)
        {
            local = local[(bang + 1)..];
        }

        var parts = local.Split(':');
        if (parts.Length is < 1 or > 2 || !TryParseCell(parts[0], out var c1, out var r1))
        {
            return false;
        }

        var (c2, r2) = (c1, r1);
        if (parts.Length == 2 && !TryParseCell(parts[1], out c2, out r2))
        {
            return false;
        }

        range = new CellRange(Math.Min(c1, c2), Math.Min(r1, r2), Math.Max(c1, c2), Math.Max(r1, r2));
        return true;
    }

    public static string ColumnName(int column)
    {
        var name = new StringBuilder();
        while (column > 0)
        {
            var remainder = (column - 1) % 26;
            name.Insert(0, (char)('A' + remainder));
            column = (column - 1) / 26;
        }

        return name.ToString();
    }

    public CellRange Resize(int rows, int columns) => new(FirstColumn, FirstRow, FirstColumn + columns - 1, FirstRow + rows - 1);

    public override string ToString()
        => IsSingleCell ? $"{ColumnName(FirstColumn)}{FirstRow}" : $"{ColumnName(FirstColumn)}{FirstRow}:{ColumnName(LastColumn)}{LastRow}";

    private static bool TryParseCell(string text, out int column, out int row)
    {
        column = 0;
        row = 0;
        var match = Cell.Match(text.Trim());
        if (!match.Success || !int.TryParse(match.Groups[2].Value, out row) || row < 1)
        {
            return false;
        }

        foreach (var c in match.Groups[1].Value.ToUpperInvariant())
        {
            column = column * 26 + (c - 'A' + 1);
        }

        return true;
    }
}
