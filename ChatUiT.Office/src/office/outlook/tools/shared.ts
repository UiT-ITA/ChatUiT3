/* global AbortSignal, Office */

import { ToolArgumentError } from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";

type MailboxItem = NonNullable<typeof Office.context.mailbox.item>;

export type ReadItem =
  | { mode: "read"; itemType: "message"; item: Office.MessageRead }
  | { mode: "read"; itemType: "appointment"; item: Office.AppointmentRead };

export type ComposeItem =
  | { mode: "compose"; itemType: "message"; item: Office.MessageCompose }
  | { mode: "compose"; itemType: "appointment"; item: Office.AppointmentCompose };

export type CurrentItem = ReadItem | ComposeItem;

/** The most characters of body or attachment text a tool returns. */
export const MAX_TEXT_LENGTH = 30_000;

/** The selected item, read at call time because the pinned task pane stays open when the user selects another item. */
export function getItem(): MailboxItem {
  const item = Office.context.mailbox.item;
  if (!item) {
    throw new Error("No item is selected.");
  }
  return item;
}

/**
 * The selected item with its mode and type, unless the call was cancelled. In read mode `subject` is a
 * string; in compose mode it is an Office.Subject with getAsync and setAsync.
 */
export function currentItem(signal: AbortSignal): CurrentItem {
  if (signal.aborted) {
    throw new Error("Cancelled.");
  }
  const item = getItem();
  const appointment = item.itemType === Office.MailboxEnums.ItemType.Appointment;
  if (typeof item.subject === "string") {
    return appointment ? { mode: "read", itemType: "appointment", item } : { mode: "read", itemType: "message", item };
  }
  return appointment
    ? { mode: "compose", itemType: "appointment", item }
    : { mode: "compose", itemType: "message", item };
}

/** The selected item in read mode, or an error naming the tool. */
export function readItem(signal: AbortSignal, tool: string): ReadItem {
  const current = currentItem(signal);
  if (current.mode !== "read") {
    throw new Error(`${tool} needs an item in read mode, but the selected item is a draft being composed.`);
  }
  return current;
}

/** The selected item in compose mode, or an error naming the tool. */
export function composeItem(signal: AbortSignal, tool: string): ComposeItem {
  const current = currentItem(signal);
  if (current.mode !== "compose") {
    throw new Error(
      `${tool} needs a draft being composed, but the selected item is in read mode. ` +
        "Open a reply or new message with outlook_open_form first."
    );
  }
  return current;
}

export function capText(text: string): { text: string; truncated: boolean } {
  return { text: text.slice(0, MAX_TEXT_LENGTH), truncated: text.length > MAX_TEXT_LENGTH };
}

export interface Recipient {
  name: string;
  email: string;
}

export function formatRecipient(details: Office.EmailAddressDetails | null | undefined): Recipient | null {
  return details ? { name: details.displayName, email: details.emailAddress } : null;
}

export function formatRecipients(list: Office.EmailAddressDetails[]): Recipient[] {
  return list.map((details) => ({ name: details.displayName, email: details.emailAddress }));
}

export const recipientsSchema = {
  type: "array",
  items: {
    anyOf: [
      { type: "string", description: "An email address." },
      {
        type: "object",
        properties: { name: { type: "string" }, email: { type: "string" } },
        required: ["email"],
        additionalProperties: false,
      },
    ],
  },
};

/** Recipients given as email strings or { name, email } objects, in the form Recipients.setAsync takes. */
export function optionalRecipients(args: ToolArguments, name: string): Array<string | Office.EmailUser> | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  const invalid = new ToolArgumentError(`"${name}" must be an array of email strings or { name, email } objects.`);
  if (!Array.isArray(value)) {
    throw invalid;
  }
  return value.map((entry: unknown) => {
    if (typeof entry === "string" && entry.length > 0) {
      return entry;
    }
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw invalid;
    }
    const { name: displayName, email, ...rest } = entry as Record<string, unknown>;
    if (
      typeof email !== "string" ||
      email.length === 0 ||
      (displayName !== undefined && typeof displayName !== "string") ||
      Object.keys(rest).length > 0
    ) {
      throw invalid;
    }
    return displayName ? { displayName, emailAddress: email } : email;
  });
}
