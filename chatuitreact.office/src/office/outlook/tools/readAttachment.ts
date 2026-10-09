/* global atob, Office, TextDecoder */

import { requireString, ToolArgumentError } from "../../../chat/tools/args";
import { callAsync } from "../../shared/callAsync";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { capText, MAX_TEXT_LENGTH, readItem } from "./shared";

const NAME = "outlook_read_attachment";
const TEXT_TYPE =
  /^(text\/|application\/(json|xml|xhtml\+xml|csv|ics|calendar)\b|application\/[\w.-]+\+(json|xml)\b|message\/rfc822\b)/i;
const TEXT_EXTENSION = /\.(txt|csv|json|xml|html?|ics|eml)$/i;

function isText(attachment: Office.AttachmentDetails): boolean {
  return TEXT_TYPE.test(attachment.contentType) || TEXT_EXTENSION.test(attachment.name);
}

function decodeBase64(content: string): string {
  const bytes = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export const readAttachment: OfficeToolDefinition = {
  name: NAME,
  description:
    "Read a text attachment (text, CSV, JSON, XML, HTML, iCalendar or email) of the item in read mode. " +
    `Attachment ids come from outlook_get_item. At most ${MAX_TEXT_LENGTH} characters; truncated is true when ` +
    "the text was cut. Other attachment types cannot be read.",
  requires: { set: "Mailbox", version: "1.8" },
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "The attachment id from outlook_get_item." } },
    required: ["id"],
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const id = requireString(args, "id");
    const { item } = readItem(signal, NAME);
    const attachment = item.attachments.find((candidate) => candidate.id === id);
    if (!attachment) {
      throw new ToolArgumentError(
        `The selected item has no attachment with id "${id}". Get ids with outlook_get_item.`
      );
    }
    const cannotRead = new Error(
      `The attachment "${attachment.name}" cannot be read: its type is ${attachment.contentType || "unknown"}, ` +
        "and only text attachments can be read."
    );

    const content = await callAsync<Office.AttachmentContent>((callback) =>
      item.getAttachmentContentAsync(id, callback)
    );
    let text: string;
    switch (content.format) {
      case Office.MailboxEnums.AttachmentContentFormat.Base64:
        if (!isText(attachment)) {
          throw cannotRead;
        }
        text = decodeBase64(content.content);
        break;
      case Office.MailboxEnums.AttachmentContentFormat.Eml:
      case Office.MailboxEnums.AttachmentContentFormat.ICalendar:
        text = content.content;
        break;
      default:
        throw cannotRead;
    }
    return { id, name: attachment.name, contentType: attachment.contentType, ...capText(text) };
  },
};
