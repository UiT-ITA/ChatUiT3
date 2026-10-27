import type { OfficeToolDefinition } from "../../shared/officeTool";
import { addShape } from "./addShape";
import { addSlide } from "./addSlide";
import { formatShape } from "./formatShape";
import { getOverview } from "./getOverview";
import { getSelection } from "./getSelection";
import { getSlideImage } from "./getSlideImage";
import { insertImage } from "./insertImage";
import { insertTable } from "./insertTable";
import { manageSlides } from "./manageSlides";
import { readSlide } from "./readSlide";
import { runScript } from "./runScript";
import { setText } from "./setText";

export const powerPointTools: readonly OfficeToolDefinition[] = [
  getOverview,
  getSelection,
  readSlide,
  getSlideImage,
  addSlide,
  manageSlides,
  setText,
  addShape,
  formatShape,
  insertImage,
  insertTable,
  runScript,
];
