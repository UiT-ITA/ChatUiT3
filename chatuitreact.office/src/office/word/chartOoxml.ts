import { strToU8, zipSync } from "fflate";
import { bytesToBase64 } from "../../chat/base64";
import { escapeXml, flatPackage, OFFICE_RELATIONSHIP, relationship, relationshipsXml } from "./ooxml";

/**
 * Builds a flat OPC package with a native Word chart: a drawing that references a chart part with
 * cached values, and the embedded workbook that holds the data, so Word's "Edit Data" works.
 */

export const CHART_TYPES = ["column", "bar", "line", "area", "pie", "doughnut", "scatter"] as const;
export const LEGEND_POSITIONS = ["right", "bottom", "top", "left", "none"] as const;
export const STACKINGS = ["none", "stacked", "percent"] as const;

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartSpec {
  type: (typeof CHART_TYPES)[number];
  /** Category labels, or the X values of a scatter chart. */
  categories: Array<string | number>;
  series: ChartSeries[];
  title?: string;
  categoryAxisTitle?: string;
  valueAxisTitle?: string;
  legend: (typeof LEGEND_POSITIONS)[number];
  stacking: (typeof STACKINGS)[number];
  /** Size in points. */
  width: number;
  height: number;
}

const EMU_PER_POINT = 12700;
const CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const CATEGORY_AXIS = "500000001";
const VALUE_AXIS = "500000002";

export function chartPackage(spec: ChartSpec): string {
  const id = Math.floor(Math.random() * 1_000_000) + 1;
  const description = spec.title ? ` descr="${escapeXml(spec.title)}"` : "";
  const drawing =
    "<w:p><w:r><w:drawing>" +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${Math.round(spec.width * EMU_PER_POINT)}" cy="${Math.round(spec.height * EMU_PER_POINT)}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    `<wp:docPr id="${id}" name="Chart ${id}"${description}/><wp:cNvGraphicFramePr/>` +
    `<a:graphic><a:graphicData uri="${CHART_NS}"><c:chart r:id="rIdChart1"/></a:graphicData></a:graphic>` +
    "</wp:inline></w:drawing></w:r></w:p>";

  return flatPackage(
    drawing,
    [relationship("rIdChart1", "chart", "charts/chart1.xml")],
    [
      {
        name: "/word/charts/chart1.xml",
        contentType: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
        xml: chartXml(spec),
      },
      {
        name: "/word/charts/_rels/chart1.xml.rels",
        contentType: "application/vnd.openxmlformats-package.relationships+xml",
        xml: relationshipsXml([relationship("rId1", "package", "../embeddings/Microsoft_Excel_Worksheet1.xlsx")]),
      },
      {
        name: "/word/embeddings/Microsoft_Excel_Worksheet1.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: bytesToBase64(workbook(spec)),
      },
    ]
  );
}

function chartXml(spec: ChartSpec): string {
  const legend =
    spec.legend === "none"
      ? ""
      : `<c:legend><c:legendPos val="${spec.legend.charAt(0)}"/><c:overlay val="0"/></c:legend>`;
  return (
    `<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_RELATIONSHIP}">` +
    '<c:date1904 val="0"/><c:roundedCorners val="0"/><c:chart>' +
    (spec.title ? titleXml(spec.title, false) : "") +
    `<c:autoTitleDeleted val="${spec.title ? 0 : 1}"/>` +
    `<c:plotArea><c:layout/>${plotXml(spec)}${axesXml(spec)}</c:plotArea>` +
    `${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    '<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>'
  );
}

function plotXml(spec: ChartSpec): string {
  const series = spec.series.map((_, index) => seriesXml(spec, index)).join("");
  const axisIds = `<c:axId val="${CATEGORY_AXIS}"/><c:axId val="${VALUE_AXIS}"/>`;
  const grouping = spec.stacking === "stacked" ? "stacked" : spec.stacking === "percent" ? "percentStacked" : undefined;
  switch (spec.type) {
    case "column":
    case "bar":
      return (
        `<c:barChart><c:barDir val="${spec.type === "column" ? "col" : "bar"}"/>` +
        `<c:grouping val="${grouping ?? "clustered"}"/><c:varyColors val="0"/>${series}` +
        `<c:gapWidth val="150"/>${grouping ? '<c:overlap val="100"/>' : ""}${axisIds}</c:barChart>`
      );
    case "line":
      return (
        `<c:lineChart><c:grouping val="${grouping ?? "standard"}"/><c:varyColors val="0"/>${series}` +
        `<c:marker val="1"/>${axisIds}</c:lineChart>`
      );
    case "area":
      return (
        `<c:areaChart><c:grouping val="${grouping ?? "standard"}"/><c:varyColors val="0"/>${series}` +
        `${axisIds}</c:areaChart>`
      );
    case "pie":
      return `<c:pieChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="0"/></c:pieChart>`;
    case "doughnut":
      return (
        `<c:doughnutChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="0"/>` +
        '<c:holeSize val="50"/></c:doughnutChart>'
      );
    case "scatter":
      return (
        `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${series}${axisIds}` +
        "</c:scatterChart>"
      );
  }
}

function seriesXml(spec: ChartSpec, index: number): string {
  const series = spec.series[index];
  const column = columnName(index + 1);
  const last = spec.categories.length + 1;
  const name =
    `<c:tx><c:strRef><c:f>Sheet1!$${column}$1</c:f>` +
    `<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt></c:strCache>` +
    "</c:strRef></c:tx>";
  const values = numberRef(`Sheet1!$${column}$2:$${column}$${last}`, series.values);
  const head = `<c:idx val="${index}"/><c:order val="${index}"/>${name}`;

  if (spec.type === "scatter") {
    const xValues = numberRef(`Sheet1!$A$2:$A$${last}`, spec.categories.map(Number));
    return (
      `<c:ser>${head}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>` +
      `<c:xVal>${xValues}</c:xVal><c:yVal>${values}</c:yVal><c:smooth val="0"/></c:ser>`
    );
  }
  const categories =
    `<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${last}</c:f><c:strCache><c:ptCount val="${spec.categories.length}"/>` +
    spec.categories.map((category, i) => `<c:pt idx="${i}"><c:v>${escapeXml(String(category))}</c:v></c:pt>`).join("") +
    "</c:strCache></c:strRef></c:cat>";
  const body = `${categories}<c:val>${values}</c:val>`;
  switch (spec.type) {
    case "column":
    case "bar":
      return `<c:ser>${head}<c:invertIfNegative val="0"/>${body}</c:ser>`;
    case "line":
      return `<c:ser>${head}${body}<c:smooth val="0"/></c:ser>`;
    default:
      return `<c:ser>${head}${body}</c:ser>`;
  }
}

function numberRef(formula: string, values: number[]): string {
  return (
    `<c:numRef><c:f>${formula}</c:f><c:numCache><c:formatCode>General</c:formatCode>` +
    `<c:ptCount val="${values.length}"/>` +
    values.map((value, index) => `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`).join("") +
    "</c:numCache></c:numRef>"
  );
}

function axesXml(spec: ChartSpec): string {
  if (spec.type === "pie" || spec.type === "doughnut") {
    return "";
  }
  const horizontalBars = spec.type === "bar";
  const valueFormat = spec.stacking === "percent" ? "0%" : "General";
  const crossBetween = spec.type === "column" || spec.type === "bar" || spec.type === "line" ? "between" : "midCat";
  const valueAxis = (axisId: string, crossAxis: string, position: "l" | "b", title?: string, gridlines = true) =>
    `<c:valAx><c:axId val="${axisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="${position}"/>${gridlines ? "<c:majorGridlines/>" : ""}` +
    (title ? titleXml(title, position === "l") : "") +
    `<c:numFmt formatCode="${valueFormat}" sourceLinked="${spec.stacking === "percent" ? 0 : 1}"/>` +
    '<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
    `<c:crossAx val="${crossAxis}"/><c:crosses val="autoZero"/><c:crossBetween val="${crossBetween}"/></c:valAx>`;

  if (spec.type === "scatter") {
    return (
      valueAxis(CATEGORY_AXIS, VALUE_AXIS, "b", spec.categoryAxisTitle, false) +
      valueAxis(VALUE_AXIS, CATEGORY_AXIS, "l", spec.valueAxisTitle)
    );
  }
  const categoryPosition = horizontalBars ? "l" : "b";
  const categoryAxis =
    `<c:catAx><c:axId val="${CATEGORY_AXIS}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="${categoryPosition}"/>` +
    (spec.categoryAxisTitle ? titleXml(spec.categoryAxisTitle, categoryPosition === "l") : "") +
    '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/>' +
    `<c:tickLblPos val="nextTo"/><c:crossAx val="${VALUE_AXIS}"/><c:crosses val="autoZero"/><c:auto val="1"/>` +
    '<c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>';
  return categoryAxis + valueAxis(VALUE_AXIS, CATEGORY_AXIS, horizontalBars ? "b" : "l", spec.valueAxisTitle);
}

function titleXml(text: string, vertical: boolean): string {
  return (
    `<c:title><c:tx><c:rich><a:bodyPr${vertical ? ' rot="-5400000" vert="horz"' : ""}/><a:lstStyle/>` +
    `<a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
  );
}

/** Column letters of a 0-based column index: 0 is A, 26 is AA. */
function columnName(index: number): string {
  let name = "";
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  }
  return name;
}

/** A minimal xlsx with the chart data: categories in column A, one series per column from B, names in row 1. */
function workbook(spec: ChartSpec): Uint8Array {
  const cell = (column: number, row: number, value: string | number) => {
    const ref = `${columnName(column)}${row}`;
    return typeof value === "number"
      ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  };
  const header = spec.series.map((series, index) => cell(index + 1, 1, series.name)).join("");
  const rows = spec.categories.map((category, i) => {
    const values = spec.series.map((series, index) => cell(index + 1, i + 2, series.values[i])).join("");
    return `<row r="${i + 2}">${cell(0, i + 2, category)}${values}</row>`;
  });
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const sheet = (path: string) => `application/vnd.openxmlformats-officedocument.spreadsheetml.${path}+xml`;

  return zipSync({
    "[Content_Types].xml": strToU8(
      `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/xl/workbook.xml" ContentType="${sheet("sheet.main")}"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${sheet("worksheet")}"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${sheet("styles")}"/></Types>`
    ),
    "_rels/.rels": strToU8(declaration + relationshipsXml([relationship("rId1", "officeDocument", "xl/workbook.xml")])),
    "xl/workbook.xml": strToU8(
      `${declaration}<workbook xmlns="${SHEET_NS}" xmlns:r="${OFFICE_RELATIONSHIP}">` +
        '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      declaration +
        relationshipsXml([
          relationship("rId1", "worksheet", "worksheets/sheet1.xml"),
          relationship("rId2", "styles", "styles.xml"),
        ])
    ),
    "xl/styles.xml": strToU8(
      `${declaration}<styleSheet xmlns="${SHEET_NS}">` +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `${declaration}<worksheet xmlns="${SHEET_NS}"><sheetData>` +
        `<row r="1">${header}</row>${rows.join("")}</sheetData></worksheet>`
    ),
  });
}
