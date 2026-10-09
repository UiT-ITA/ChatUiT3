import { optionalOneOf, optionalString, ToolArgumentError } from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import { callAsync } from "../../shared/callAsync";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { composeItem, optionalRecipients, recipientsSchema } from "./shared";

const NAME = "outlook_set_fields";
const OPERATIONS = ["set", "add"] as const;
const RECIPIENT_FIELDS = ["to", "cc", "bcc"] as const;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

function optionalDateTime(args: ToolArguments, name: string): Date | undefined {
  const value = optionalString(args, name);
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  if (!ISO_DATE_TIME.test(value) || Number.isNaN(date.getTime())) {
    throw new ToolArgumentError(`"${name}" must be an ISO 8601 date-time, such as 2026-03-01T14:00:00+01:00.`);
  }
  return date;
}

export const setFields: OfficeToolDefinition = {
  name: NAME,
  description:
    "Change fields of the draft being composed; only the given fields change. subject for both. For a message: " +
    "to, cc and bcc, where recipientOperation set replaces each given list and add appends to it. For an " +
    "appointment: start and end (ISO 8601 date-times; without an offset they are local time) and location.",
  parameters: {
    type: "object",
    properties: {
      subject: { type: "string" },
      to: recipientsSchema,
      cc: recipientsSchema,
      bcc: recipientsSchema,
      recipientOperation: { type: "string", enum: [...OPERATIONS], description: "Required with to, cc or bcc." },
      start: { type: "string" },
      end: { type: "string" },
      location: { type: "string" },
    },
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const subject = optionalString(args, "subject");
    const recipients = {
      to: optionalRecipients(args, "to"),
      cc: optionalRecipients(args, "cc"),
      bcc: optionalRecipients(args, "bcc"),
    };
    const operation = optionalOneOf(args, "recipientOperation", OPERATIONS);
    const start = optionalDateTime(args, "start");
    const end = optionalDateTime(args, "end");
    const location = optionalString(args, "location");

    const hasRecipients = RECIPIENT_FIELDS.some((field) => recipients[field] !== undefined);
    const hasAppointmentFields = start !== undefined || end !== undefined || location !== undefined;
    if (subject === undefined && !hasRecipients && !hasAppointmentFields) {
      throw new ToolArgumentError("Give at least one field to change.");
    }
    if (hasRecipients && !operation) {
      throw new ToolArgumentError(`"recipientOperation" is required with "to", "cc" or "bcc".`);
    }
    if (start && end && end < start) {
      throw new ToolArgumentError(`"end" must not be before "start".`);
    }

    const current = composeItem(signal, NAME);
    if (current.itemType === "message" && hasAppointmentFields) {
      throw new ToolArgumentError(`"start", "end" and "location" are only for appointments.`);
    }
    if (current.itemType === "appointment" && hasRecipients) {
      throw new ToolArgumentError(`"to", "cc" and "bcc" are only for messages.`);
    }

    const changed: string[] = [];
    if (subject !== undefined) {
      await callAsync<void>((callback) => current.item.subject.setAsync(subject, callback));
      changed.push("subject");
    }
    if (current.itemType === "message") {
      for (const field of RECIPIENT_FIELDS) {
        const list = recipients[field];
        if (list) {
          const target = current.item[field];
          await callAsync<void>((callback) =>
            operation === "add" ? target.addAsync(list, callback) : target.setAsync(list, callback)
          );
          changed.push(field);
        }
      }
    } else {
      const { item } = current;
      // Start first: Outlook moves the end to keep the duration when the start changes.
      if (start) {
        await callAsync<void>((callback) => item.start.setAsync(start, callback));
        changed.push("start");
      }
      if (end) {
        await callAsync<void>((callback) => item.end.setAsync(end, callback));
        changed.push("end");
      }
      if (location !== undefined) {
        await callAsync<void>((callback) => item.location.setAsync(location, callback));
        changed.push("location");
      }
    }
    return { changed };
  },
};
