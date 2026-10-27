import type { OfficeToolDefinition } from "../../shared/officeTool";
import { bookmarks } from "./bookmarks";
import { comments } from "./comments";
import { contentControls } from "./contentControls";
import { defineStyle } from "./defineStyle";
import { deleteParagraphs } from "./deleteParagraphs";
import { documentProperties } from "./documentProperties";
import { editTable } from "./editTable";
import { fields } from "./fields";
import { formatList } from "./formatList";
import { formatParagraphs } from "./formatParagraphs";
import { formatText } from "./formatText";
import { getOoxml } from "./getOoxml";
import { getOverview } from "./getOverview";
import { getPageImage } from "./getPageImage";
import { getSelection } from "./getSelection";
import { insertBreak } from "./insertBreak";
import { insertChart } from "./insertChart";
import { insertContent } from "./insertContent";
import { insertImage } from "./insertImage";
import { insertNote } from "./insertNote";
import { insertOoxml } from "./insertOoxml";
import { insertTable } from "./insertTable";
import { listStyles } from "./listStyles";
import { pageSetup } from "./pageSetup";
import { readParagraphs } from "./readParagraphs";
import { readTable } from "./readTable";
import { replaceParagraphs } from "./replaceParagraphs";
import { replaceText } from "./replaceText";
import { runScript } from "./runScript";
import { search } from "./search";
import { setHeaderFooter } from "./setHeaderFooter";
import { setStyle } from "./setStyle";
import { trackedChanges } from "./trackedChanges";

export const wordTools: readonly OfficeToolDefinition[] = [
  getOverview,
  getSelection,
  getPageImage,
  readParagraphs,
  search,
  replaceText,
  insertContent,
  replaceParagraphs,
  deleteParagraphs,
  setStyle,
  formatText,
  formatParagraphs,
  listStyles,
  defineStyle,
  formatList,
  insertTable,
  readTable,
  editTable,
  insertImage,
  insertChart,
  insertBreak,
  pageSetup,
  setHeaderFooter,
  fields,
  insertNote,
  bookmarks,
  contentControls,
  comments,
  trackedChanges,
  documentProperties,
  getOoxml,
  insertOoxml,
  runScript,
];
