import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getItem } from "./getItem";
import { openForm } from "./openForm";
import { readAttachment } from "./readAttachment";
import { setBody } from "./setBody";
import { setFields } from "./setFields";

export const outlookTools: readonly OfficeToolDefinition[] = [getItem, readAttachment, openForm, setBody, setFields];
