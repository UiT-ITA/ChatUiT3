/**
 * Every error code the add-in shows to users, listed in docs/error-codes.md. E3000–E3999 are the add-in's,
 * E5800–E5999 are file import in the add-in. A code is never reused for another kind of error.
 */

export interface ErrorCode {
  code: string;
  message: string;
}

function code(value: string, message: string): ErrorCode {
  return { code: value, message };
}

export const ErrorCodes = {
  // E3000–E3099: chat responses
  ResponseUnexpected: code("E3001", "The response could not be completed because of an error in the add-in."),
  ConnectionFailed: code("E3002", "ChatUiT could not reach the server. Check the network connection and try again."),
  ConnectionTimedOut: code("E3003", "The request to the ChatUiT server timed out."),
  StreamEnded: code("E3004", "The response ended before it was complete."),
  ResponseFailed: code("E3005", "The server could not complete the response."),
  StreamError: code("E3006", "The server reported an error while generating the response."),
  HttpUnauthorized: code("E3007", "The server did not accept your sign-in. Reopen the pane and try again."),
  HttpForbidden: code("E3008", "The server denied access to the request."),
  HttpNotFound: code("E3009", "The server could not find what the add-in asked for."),
  HttpTooManyRequests: code("E3010", "Too many requests. Wait a moment and try again."),
  HttpServerError: code("E3011", "The ChatUiT server failed to handle the request."),
  HttpRejected: code("E3012", "The server rejected the request."),

  // E3100–E3199: sign-in
  SignInCancelled: code("E3101", "The sign-in was cancelled."),
  SignInTimedOut: code("E3102", "The browser sign-in did not finish in time."),
  SignInRejected: code("E3103", "The sign-in failed."),
  SignInTokenFailed: code("E3104", "The sign-in could not be completed."),
  PopupSignInFailed: code("E3105", "The Microsoft sign-in failed."),
  SignInStartFailed: code("E3106", "Sign-in could not start."),
  BrowserSignInFailed: code("E3107", "The browser sign-in failed."),
  SignInRelayRejected: code("E3110", "The sign-in could not be passed on to ChatUiT."),
  SignInRelayUnreachable: code("E3111", "The sign-in page could not reach ChatUiT."),

  // E3200–E3299: approvals and questions
  AnswerWhileBusy: code("E3201", "Wait for the current response to finish."),
  ApprovalUnknown: code("E3202", "Unknown approval request."),
  ApprovalNotPending: code("E3203", "This approval request is no longer pending."),
  AnswerCountMismatch: code("E3204", "Give one answer per question."),
  AnswerEmpty: code("E3205", "An answer picks an option or has text."),
  EditNotAllowed: code("E3206", "This request does not allow edited arguments."),
  EditNotObject: code("E3207", "Edited arguments must be a JSON object."),
  AnswerFailed: code("E3208", "The answer could not be sent."),

  // E3300–E3399: chat history
  SavedChatsUnreadable: code("E3301", "The saved chats could not be read."),

  // E3400–E3499: hosts
  HostUnsupported: code("E3401", "Open ChatUiT from Word, Excel, PowerPoint or Outlook."),
  HostTooOld: code("E3402", "ChatUiT needs a newer version of the Office app."),
  TeamsNotInMeeting: code("E3403", "Open ChatUiT from a Teams meeting."),
  TeamsSidePanelFailed: code("E3404", "The ChatUiT side panel could not be added."),
  TrackChangesUnreadable: code("E3405", "The track changes setting could not be read."),
  TrackChangesUnchanged: code("E3406", "The track changes setting could not be changed."),

  // E5800–E5999: file import
  FileTypeUnsupported: code("E5801", "This file type is not supported."),
  TooManyFiles: code("E5802", "Too many files go with one message."),
  AppUpdated: code("E5803", "A new version of ChatUiT is available. Reopen the pane and try again."),
  FileUnreadable: code("E5804", "The file could not be read."),
  PdfUnreadable: code("E5810", "The PDF file could not be read."),
  DocxUnreadable: code("E5820", "The Word file could not be read."),
  DocxContentMissing: code("E5821", "The Word file has no document content."),
  DocxBodyMissing: code("E5822", "The Word file has no document body."),
  PptxUnreadable: code("E5830", "The PowerPoint file could not be read."),
  XlsxUnreadable: code("E5840", "The Excel file could not be read."),
  XlsxImagesUnsupported: code("E5841", "The images in this Excel file cannot be read."),
  TextUnreadable: code("E5850", "The text file could not be read."),
  ImageUnreadable: code("E5860", "The image could not be read."),
  CanvasUnavailable: code("E5870", "The file could not be read because drawing is unavailable in this pane."),
  ImageDecodeFailed: code("E5871", "An image in the file could not be decoded."),
  ImageBlobUnreadable: code("E5872", "An image in the file could not be loaded."),
  ImageEncodeFailed: code("E5873", "An image in the file could not be converted."),
} as const satisfies Record<string, ErrorCode>;

/** The response header that carries the server's reference of the request. */
export const REF_HEADER = "X-ChatUiT-Ref";

/** Matches a text that ends with one or more error codes, with or without a reference: "(E2101, ref 3f9a1c2e)" or "(E5043, E5046, ref 3f9a1c2e)". */
const CODED_TEXT = /\(E\d{4}(?:, E\d{4})*(?:, ref [0-9a-f]{8})?\)$/;

export interface FormatOptions {
  /** The server's reference of the request. */
  ref?: string | null;
  /** Shown after the message: "message: detail", or "message. Details: detail" after a message of several sentences. */
  detail?: string | null;
}

/** "message (E3001, ref 3f9a1c2e)", or "message (E3001)" without a reference. */
export function formatError(error: ErrorCode, options: FormatOptions = {}): string {
  const detail = options.detail?.trim();
  const sentence = error.message.replace(/\.$/, "");
  const text = !detail
    ? error.message
    : sentence.includes(". ")
      ? `${error.message} Details: ${detail}`
      : `${sentence}: ${detail}`;
  return options.ref ? `${text} (${error.code}, ref ${options.ref})` : `${text} (${error.code})`;
}

/** An error whose message is the text shown to the user, with its code. */
export class UserError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UserError";
  }
}

/** A UserError for the code. */
export function userError(error: ErrorCode, options: FormatOptions & { cause?: unknown } = {}): UserError {
  return new UserError(formatError(error, options), { cause: options.cause });
}

/** True when the text already ends with an error code. */
export function hasErrorCode(text: string): boolean {
  return CODED_TEXT.test(text.trim());
}

/** A server error text: as it is when it has a code, otherwise the fallback with the text as detail. */
export function serverError(
  text: string | null | undefined,
  fallback: ErrorCode,
  options: { ref?: string | null; cause?: unknown } = {}
): UserError {
  if (text && hasErrorCode(text)) {
    return new UserError(text.trim(), { cause: options.cause });
  }
  return userError(fallback, { ...options, detail: text });
}

/** The UserError in the error or its causes, or null. */
export function findUserError(error: unknown): UserError | null {
  for (let current = error, depth = 0; current && depth < 10; depth += 1) {
    if (current instanceof UserError) {
      return current;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/** The error's own message. */
export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The text to show for the error: its UserError's message, or the fallback with the error as detail. */
export function userErrorText(error: unknown, fallback: ErrorCode, ref?: string | null): string {
  return findUserError(error)?.message ?? formatError(fallback, { ref, detail: errorDetail(error) });
}

/** The server's reference from the response headers, or null. */
export function refFrom(headers: { get(name: string): string | null } | null | undefined): string | null {
  const value = headers?.get(REF_HEADER)?.trim().toLowerCase();
  return value && /^[0-9a-f]{8}$/.test(value) ? value : null;
}
