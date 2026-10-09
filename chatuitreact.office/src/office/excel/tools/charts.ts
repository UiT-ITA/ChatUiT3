/* global Excel */

import {
  optionalOneOf,
  optionalPositiveNumber,
  optionalString,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, getSheet, parseAddress, runExcel } from "./shared";

const ACTIONS = ["add", "update", "delete"] as const;
const CHART_TYPES = [
  "ColumnClustered",
  "ColumnStacked",
  "ColumnStacked100",
  "BarClustered",
  "BarStacked",
  "BarStacked100",
  "Line",
  "LineMarkers",
  "LineStacked",
  "Pie",
  "Doughnut",
  "Area",
  "AreaStacked",
  "XYScatter",
  "XYScatterLines",
  "XYScatterSmooth",
  "Bubble",
  "Radar",
] as const;
const SERIES_BY = ["Auto", "Rows", "Columns"] as const;

interface ChartChanges {
  type?: (typeof CHART_TYPES)[number];
  title?: string;
  categoryAxisTitle?: string;
  valueAxisTitle?: string;
  topLeftCell?: string;
  width?: number;
  height?: number;
}

export const charts: OfficeToolDefinition = {
  name: "excel_charts",
  description:
    "Work with charts. add: a chart of type from the data at source (headers in the first row or column become " +
    "series names and categories), on sheet (default the source's sheet). update: change chart name on sheet. " +
    "delete: chart name on sheet. title, categoryAxisTitle and valueAxisTitle set texts (an empty string hides " +
    "them; pie and doughnut charts have no axes). topLeftCell (a cell on the chart's sheet, such as F2), width " +
    "and height (points) place it. Returns the chart name and sheet. Chart names and sheets come from " +
    `excel_get_overview.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      name: { type: "string", description: "The chart; for add, an optional name for the new chart." },
      sheet: { type: "string", description: "The chart's sheet. Default: the source's sheet, or the active sheet." },
      type: { type: "string", enum: [...CHART_TYPES] },
      source: { type: "string", description: "For add: the data range, such as Sheet1!A1:C10." },
      seriesBy: { type: "string", enum: [...SERIES_BY], description: "For add: series in rows or columns." },
      title: { type: "string" },
      categoryAxisTitle: { type: "string" },
      valueAxisTitle: { type: "string" },
      topLeftCell: { type: "string" },
      width: { type: "number", exclusiveMinimum: 0 },
      height: { type: "number", exclusiveMinimum: 0 },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const sheetName = optionalString(args, "sheet");
    const changes = readChanges(args);

    if (action === "add") {
      if (!changes.type) {
        throw new ToolArgumentError(`"type" is required for add.`);
      }
      const type = changes.type;
      const source = requireString(args, "source");
      const seriesBy = optionalOneOf(args, "seriesBy", SERIES_BY) ?? "Auto";
      const name = optionalString(args, "name");
      return runExcel(signal, async (context) => {
        const sheet = getSheet(context, sheetName ?? parseAddress(source).sheet).load("name");
        const chart = sheet.charts.add(type, getRange(context, source), seriesBy);
        if (name) {
          chart.name = name;
        }
        applyChanges(chart, { ...changes, type: undefined });
        chart.load("name");
        await context.sync();
        return { chart: chart.name, sheet: sheet.name };
      });
    }

    const name = requireString(args, "name");
    if (action === "update" && Object.values(changes).every((value) => value === undefined)) {
      throw new ToolArgumentError("Give at least one property to change.");
    }
    return runExcel(signal, async (context) => {
      const sheet = getSheet(context, sheetName).load("name");
      const chart = sheet.charts.getItem(name);
      if (action === "delete") {
        chart.delete();
        await context.sync();
        return { deleted: name, sheet: sheet.name };
      }
      applyChanges(chart, changes);
      await context.sync();
      return { chart: name, sheet: sheet.name };
    });
  },
};

function readChanges(args: ToolArguments): ChartChanges {
  return {
    type: optionalOneOf(args, "type", CHART_TYPES),
    title: optionalString(args, "title"),
    categoryAxisTitle: optionalString(args, "categoryAxisTitle"),
    valueAxisTitle: optionalString(args, "valueAxisTitle"),
    topLeftCell: optionalString(args, "topLeftCell"),
    width: optionalPositiveNumber(args, "width"),
    height: optionalPositiveNumber(args, "height"),
  };
}

function applyChanges(chart: Excel.Chart, changes: ChartChanges): void {
  if (changes.type) {
    chart.chartType = changes.type;
  }
  setTitle(chart.title, changes.title);
  // Pie and doughnut charts have no axes, so the axes are only touched when a title is given.
  if (changes.categoryAxisTitle !== undefined) {
    setTitle(chart.axes.categoryAxis.title, changes.categoryAxisTitle);
  }
  if (changes.valueAxisTitle !== undefined) {
    setTitle(chart.axes.valueAxis.title, changes.valueAxisTitle);
  }
  if (changes.topLeftCell) {
    chart.setPosition(changes.topLeftCell);
  }
  if (changes.width !== undefined) {
    chart.width = changes.width;
  }
  if (changes.height !== undefined) {
    chart.height = changes.height;
  }
}

function setTitle(title: Excel.ChartTitle | Excel.ChartAxisTitle, text: string | undefined): void {
  if (text === undefined) {
    return;
  }
  title.visible = text.length > 0;
  if (text) {
    title.text = text;
  }
}
