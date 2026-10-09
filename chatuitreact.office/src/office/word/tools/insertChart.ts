import {
  optionalPositiveNumber,
  optionalOneOf,
  optionalString,
  requireNumberArray,
  requireObjectArray,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { CHART_TYPES, chartPackage, LEGEND_POSITIONS, STACKINGS, type ChartSeries } from "../chartOoxml";
import { insertAtLocation, locationProperties, readInsertLocation, runWord } from "./shared";

const DEFAULT_WIDTH = 432;
const DEFAULT_HEIGHT = 252;

export const insertChart: OfficeToolDefinition = {
  name: "word_insert_chart",
  description:
    "Insert a native, editable Word chart (the user can use Edit Data in Word). Each series has one value per " +
    "category; for scatter, categories are the X values. To update a chart, insert a new one with location " +
    `replace on the paragraph that holds the old chart.`,
  parameters: {
    type: "object",
    properties: {
      ...locationProperties,
      type: { type: "string", enum: [...CHART_TYPES] },
      categories: { type: "array", items: { type: ["string", "number"] } },
      series: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, values: { type: "array", items: { type: "number" } } },
          required: ["name", "values"],
          additionalProperties: false,
        },
        description: "Pie charts take one series.",
      },
      title: { type: "string" },
      categoryAxisTitle: { type: "string", description: "The category axis, or the X axis of a scatter chart." },
      valueAxisTitle: { type: "string", description: "The value axis, or the Y axis of a scatter chart." },
      legend: { type: "string", enum: [...LEGEND_POSITIONS], description: "Default right." },
      stacking: { type: "string", enum: [...STACKINGS], description: "Column, bar, line and area only. Default none." },
      width: { type: "number", exclusiveMinimum: 0, description: `Points. Default ${DEFAULT_WIDTH}.` },
      height: { type: "number", exclusiveMinimum: 0, description: `Points. Default ${DEFAULT_HEIGHT}.` },
    },
    required: ["location", "type", "categories", "series"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const location = readInsertLocation(args);
    const type = requireOneOf(args, "type", CHART_TYPES);
    const categories = args.categories;
    if (
      !Array.isArray(categories) ||
      categories.length === 0 ||
      categories.some((category) => typeof category !== "string" && typeof category !== "number")
    ) {
      throw new ToolArgumentError(`"categories" must be a non-empty array of strings or numbers.`);
    }
    if (type === "scatter" && categories.some((category) => !Number.isFinite(Number(category)))) {
      throw new ToolArgumentError(`The categories of a scatter chart must be numbers.`);
    }
    const series: ChartSeries[] = requireObjectArray(args, "series").map((item) => ({
      name: requireString(item, "name"),
      values: requireNumberArray(item, "values"),
    }));
    if (series.length === 0 || series.some((item) => item.values.length !== categories.length)) {
      throw new ToolArgumentError(`Give at least one series, each with one value per category.`);
    }
    if (type === "pie" && series.length !== 1) {
      throw new ToolArgumentError(`A pie chart takes exactly one series.`);
    }
    const stacking = optionalOneOf(args, "stacking", STACKINGS) ?? "none";
    if (stacking !== "none" && (type === "pie" || type === "doughnut" || type === "scatter")) {
      throw new ToolArgumentError(`"stacking" applies to column, bar, line and area charts only.`);
    }
    const ooxml = chartPackage({
      type,
      categories: type === "scatter" ? categories.map(Number) : (categories as Array<string | number>),
      series,
      title: optionalString(args, "title"),
      categoryAxisTitle: optionalString(args, "categoryAxisTitle"),
      valueAxisTitle: optionalString(args, "valueAxisTitle"),
      legend: optionalOneOf(args, "legend", LEGEND_POSITIONS) ?? "right",
      stacking,
      width: optionalPositiveNumber(args, "width") ?? DEFAULT_WIDTH,
      height: optionalPositiveNumber(args, "height") ?? DEFAULT_HEIGHT,
    });

    return runWord(signal, async (context) => {
      const paragraph = await insertAtLocation(context, location, (range) =>
        range.insertOoxml(ooxml, "Replace").paragraphs.getFirst().load("uniqueLocalId")
      );
      return { chartParagraphId: paragraph.uniqueLocalId };
    });
  },
};
