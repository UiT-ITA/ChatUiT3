import { optionalString } from "../../../chat/tools/args";
import { ToolResultWithImages } from "../../../chat/tools/types";
import { toModelImage } from "../../shared/image";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getSheet, parseAddress, runExcel } from "./shared";

/** At most this many chart pictures come with a picture of the sheet. */
const MAX_CHARTS = 3;

export const getImage: OfficeToolDefinition = {
  name: "excel_get_image",
  description:
    "See a part of the workbook as the user sees it, as pictures. With address: a picture of those cells. With " +
    "chart: a picture of that chart (on the sheet of address, or the active sheet). Without either: a picture of " +
    "the active sheet's used range and of up to 3 charts on it. A picture of cells does not show charts or shapes " +
    "on top of them; check where they sit with excel_get_layout.",
  requires: { set: "ExcelApi", version: "1.7" },
  parameters: {
    type: "object",
    properties: {
      address: { type: "string" },
      chart: { type: "string", description: "A chart name from excel_get_overview." },
    },
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const address = optionalString(args, "address");
    const chartName = optionalString(args, "chart");
    const shots = await runExcel(signal, async (context) => {
      const parsed = address ? parseAddress(address) : null;
      const sheet = getSheet(context, parsed?.sheet).load("name");
      if (chartName) {
        const image = sheet.charts.getItem(chartName).getImage();
        await context.sync();
        // getImage returns a ClientResult, which is filled by the sync and has nothing to load.
        // eslint-disable-next-line office-addins/load-object-before-read
        return [{ what: `chart ${chartName} on ${sheet.name}`, base64: image.value }];
      }
      const cells = parsed ? sheet.getRange(parsed.cells) : sheet.getUsedRangeOrNullObject();
      cells.load("isNullObject,address");
      const charts = parsed ? null : sheet.charts.load("items/name");
      await context.sync();
      if (cells.isNullObject) {
        return [];
      }
      const images = [{ what: `cells ${cells.address}`, result: cells.getImage() }];
      for (const chart of (charts?.items ?? []).slice(0, MAX_CHARTS)) {
        images.push({ what: `chart ${chart.name} on ${sheet.name}`, result: chart.getImage() });
      }
      await context.sync();
      return images.map((image) => ({ what: image.what, base64: image.result.value }));
    });
    if (shots.length === 0) {
      return { pictures: [], note: "The sheet has no content to show." };
    }
    const images = await Promise.all(shots.map((shot) => toModelImage(shot.base64)));
    return new ToolResultWithImages({ pictures: shots.map((shot) => shot.what) }, images);
  },
};
