import type { OfficeToolDefinition } from "../../shared/officeTool";
import { charts } from "./charts";
import { clearRange } from "./clearRange";
import { comments } from "./comments";
import { conditionalFormats } from "./conditionalFormats";
import { dataValidation } from "./dataValidation";
import { find } from "./find";
import { formatRange } from "./formatRange";
import { getImage } from "./getImage";
import { getLayout } from "./getLayout";
import { getOverview } from "./getOverview";
import { getSelection } from "./getSelection";
import { insertDelete } from "./insertDelete";
import { namedRanges } from "./namedRanges";
import { pivotTables } from "./pivotTables";
import { readRange } from "./readRange";
import { runScript } from "./runScript";
import { sheets } from "./sheets";
import { sortFilter } from "./sortFilter";
import { tables } from "./tables";
import { writeRange } from "./writeRange";

export const excelTools: readonly OfficeToolDefinition[] = [
  getOverview,
  getSelection,
  getLayout,
  getImage,
  readRange,
  writeRange,
  formatRange,
  clearRange,
  insertDelete,
  find,
  sheets,
  tables,
  sortFilter,
  charts,
  conditionalFormats,
  dataValidation,
  namedRanges,
  pivotTables,
  comments,
  runScript,
];
