/* global Office */

import { optionalString, optionalStringArray, requireOneOf, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { markdownToHtml } from "../markdownToHtml";
import { readItem } from "./shared";

const NAME = "outlook_open_form";
const KINDS = ["reply", "replyAll", "new"] as const;

export const openForm: OfficeToolDefinition = {
  name: NAME,
  description:
    "Open a reply, reply-all or new message form from the item in read mode, with body as Markdown " +
    "(converted to HTML). to, cc and subject are only for new. The user reviews and sends the form; " +
    "the add-in never sends anything.",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...KINDS] },
      body: { type: "string", description: "Markdown." },
      to: { type: "array", items: { type: "string" }, description: "Email addresses. Only for new." },
      cc: { type: "array", items: { type: "string" }, description: "Email addresses. Only for new." },
      subject: { type: "string", description: "Only for new." },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const kind = requireOneOf(args, "kind", KINDS);
    const body = optionalString(args, "body");
    const to = optionalStringArray(args, "to");
    const cc = optionalStringArray(args, "cc");
    const subject = optionalString(args, "subject");
    if (kind !== "new" && (to !== undefined || cc !== undefined || subject !== undefined)) {
      throw new ToolArgumentError(
        `"to", "cc" and "subject" are only for kind "new"; a reply takes its recipients and subject from the item.`
      );
    }
    if ([...(to ?? []), ...(cc ?? [])].some((address) => address.length === 0)) {
      throw new ToolArgumentError(`"to" and "cc" must not contain empty strings.`);
    }

    const { item } = readItem(signal, NAME);
    const htmlBody = body ? markdownToHtml(body) : "";
    switch (kind) {
      case "reply":
        item.displayReplyForm({ htmlBody });
        break;
      case "replyAll":
        item.displayReplyAllForm({ htmlBody });
        break;
      case "new": {
        if (!Office.context.requirements.isSetSupported("Mailbox", "1.6")) {
          throw new Error("Opening a new message form needs Mailbox 1.6, which this version of Outlook lacks.");
        }
        const form: Office.MessageForm = { htmlBody };
        if (to) {
          form.toRecipients = to;
        }
        if (cc) {
          form.ccRecipients = cc;
        }
        if (subject !== undefined) {
          form.subject = subject;
        }
        Office.context.mailbox.displayNewMessageForm(form);
        break;
      }
    }
    return { opened: kind };
  },
};
