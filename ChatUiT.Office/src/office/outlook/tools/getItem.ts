/* global Office */

import { callAsync } from "../../shared/callAsync";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { capText, currentItem, formatRecipient, formatRecipients, MAX_TEXT_LENGTH } from "./shared";

async function bodyText(body: Office.Body): Promise<{ body: string; truncated: boolean }> {
  const text = await callAsync<string>((callback) => body.getAsync(Office.CoercionType.Text, callback));
  const capped = capText(text);
  return { body: capped.text, truncated: capped.truncated };
}

function getRecipients(recipients: Office.Recipients): Promise<Office.EmailAddressDetails[]> {
  return callAsync<Office.EmailAddressDetails[]>((callback) => recipients.getAsync(callback));
}

export const getItem: OfficeToolDefinition = {
  name: "outlook_get_item",
  description:
    "Get the selected Outlook item. mode is read, or compose for a draft; itemType is message or appointment. " +
    "A message in read mode has subject, from, sender, to, cc, dateTimeCreated, conversationId, " +
    "internetMessageId and attachments (ids for outlook_read_attachment). An appointment has subject, organizer, " +
    "start, end, location and attendees. A draft has its current subject, recipients or attendees, start, end and " +
    `location. The body is plain text, at most ${MAX_TEXT_LENGTH} characters; truncated is true when it was cut.`,
  parameters: { type: "object", properties: {}, additionalProperties: false },
  handler: async (_args, signal) => {
    const current = currentItem(signal);
    const { mode, itemType } = current;
    switch (current.itemType) {
      case "message": {
        if (current.mode === "read") {
          const { item } = current;
          return {
            mode,
            itemType,
            subject: item.subject,
            from: formatRecipient(item.from),
            sender: formatRecipient(item.sender),
            to: formatRecipients(item.to),
            cc: formatRecipients(item.cc),
            dateTimeCreated: item.dateTimeCreated.toISOString(),
            conversationId: item.conversationId,
            internetMessageId: item.internetMessageId,
            attachments: item.attachments.map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              contentType: attachment.contentType,
              size: attachment.size,
              isInline: attachment.isInline,
            })),
            ...(await bodyText(item.body)),
          };
        }
        const { item } = current;
        const [subject, to, cc, bcc, body] = await Promise.all([
          callAsync<string>((callback) => item.subject.getAsync(callback)),
          getRecipients(item.to),
          getRecipients(item.cc),
          getRecipients(item.bcc),
          bodyText(item.body),
        ]);
        return {
          mode,
          itemType,
          subject,
          to: formatRecipients(to),
          cc: formatRecipients(cc),
          bcc: formatRecipients(bcc),
          ...body,
        };
      }
      case "appointment": {
        if (current.mode === "read") {
          const { item } = current;
          return {
            mode,
            itemType,
            subject: item.subject,
            organizer: formatRecipient(item.organizer),
            start: item.start.toISOString(),
            end: item.end.toISOString(),
            location: item.location,
            requiredAttendees: formatRecipients(item.requiredAttendees),
            optionalAttendees: formatRecipients(item.optionalAttendees),
            ...(await bodyText(item.body)),
          };
        }
        const { item } = current;
        const [subject, requiredAttendees, optionalAttendees, start, end, location, body] = await Promise.all([
          callAsync<string>((callback) => item.subject.getAsync(callback)),
          getRecipients(item.requiredAttendees),
          getRecipients(item.optionalAttendees),
          callAsync<Date>((callback) => item.start.getAsync(callback)),
          callAsync<Date>((callback) => item.end.getAsync(callback)),
          callAsync<string>((callback) => item.location.getAsync(callback)),
          bodyText(item.body),
        ]);
        return {
          mode,
          itemType,
          subject,
          requiredAttendees: formatRecipients(requiredAttendees),
          optionalAttendees: formatRecipients(optionalAttendees),
          start: start.toISOString(),
          end: end.toISOString(),
          location,
          ...body,
        };
      }
    }
  },
};
