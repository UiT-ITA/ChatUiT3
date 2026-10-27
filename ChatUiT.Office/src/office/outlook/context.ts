import { joinContext, readWith } from "../shared/context";
import { getItem } from "./tools/getItem";

/** What the user is looking at in Outlook: the selected or open item, as outlook_get_item returns it. */
export function outlookContext(): Promise<string> {
  return joinContext("Outlook.", [["Item", () => readWith(getItem)]]);
}
