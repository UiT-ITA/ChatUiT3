/**
 * The error codes of the web client. Each code names one kind of error and is never reused.
 * docs/error-codes.md lists them with their causes.
 */
export const ErrorCode = {
  // Requests to the API
  Network: 'E1000',
  NotSignedIn: 'E1001',
  Unauthorized: 'E1002',
  Forbidden: 'E1003',
  NotFound: 'E1004',
  TooLarge: 'E1005',
  RateLimited: 'E1006',
  ServerError: 'E1007',
  RequestFailed: 'E1008',
  ServerMessageWithoutCode: 'E1009',
  ToolsNotAllowed: 'E1010',
  KnowledgeSourcesNotAllowed: 'E1011',
  InvalidTools: 'E1012',
  InvalidGroupIds: 'E1013',
  UnknownKnowledgeSources: 'E1014',
  CourseVersionChanged: 'E1015',

  // Starting the app
  RealtimeNoToken: 'E1020',
  RealtimeConnectionFailed: 'E1021',
  SignInFailed: 'E1022',
  TrainingStatusFailed: 'E1023',

  // Chat
  MessageTooLarge: 'E1030',
  ChatNotFound: 'E1031',
  AnswerNotSent: 'E1032',
  DiagramRenderFailed: 'E1033',

  // Pages
  GroupSearchFailed: 'E1040',
  CourseLoadFailed: 'E1041',
  HelpLoadFailed: 'E1042',
  AccessDenied: 'E1043',
  AssistantNotFound: 'E1044',
  GenerationNotFound: 'E1045',
  AdminItemNotFound: 'E1046',

  // Insights
  InsightsNotConfigured: 'E1050',
  InsightsNoAccess: 'E1051',
  InsightsQueryFailed: 'E1052',
  InsightsRequestFailed: 'E1053',

  // Admin and development pages
  ModelTestFailed: 'E1060',
  DevStatusFailed: 'E1061',

  // File import
  FileTypeNotSupported: 'E5500',
  AppUpdated: 'E5501',
  NoImportProcessor: 'E5502',
  ImportFailed: 'E5503',
  ImageLoadFailed: 'E5510',
  FileReadFailed: 'E5511',
  CanvasUnavailable: 'E5512',
  ImageEncodeFailed: 'E5513',
  PdfImportFailed: 'E5520',
  PdfPasswordProtected: 'E5521',
  PdfInvalid: 'E5522',
  DocxImportFailed: 'E5530',
  DocxContentMissing: 'E5531',
  DocxBodyMissing: 'E5532',
  DocxOpenFailed: 'E5533',
  PptxImportFailed: 'E5540',
  PptxOpenFailed: 'E5541',
  XlsxImportFailed: 'E5550',
  XlsxImagesUnsupported: 'E5551',
  XlsxOpenFailed: 'E5552',
  ImageImportFailed: 'E5560',
  TextImportFailed: 'E5570',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/** The text shown to the user: "<message> (E1234, ref 3f9a1c2e)", or "<message> (E1234)" without a reference. */
export function formatError(message: string, code: string, ref?: string | null): string {
  return ref ? `${message} (${code}, ref ${ref})` : `${message} (${code})`;
}

/** An error with a client code. The message is the text without the code. */
export class CodedError extends Error {
  constructor(
    readonly errorCode: ErrorCode,
    message: string,
    readonly ref?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CodedError';
  }

  /** The message with the code and reference. */
  get displayMessage(): string {
    return formatError(this.message, this.errorCode, this.ref);
  }
}

/** The reference of an error that carries one. */
export function errorRef(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'ref' in error) {
    const ref = (error as { ref: unknown }).ref;
    return typeof ref === 'string' && ref ? ref : undefined;
  }
  return undefined;
}

/** Whether the error carries a text with its code: a CodedError or an ApiError. */
export function hasDisplayMessage(error: unknown): error is Error & { displayMessage: string } {
  return error instanceof Error && typeof (error as { displayMessage?: unknown }).displayMessage === 'string';
}

/**
 * The text to show for an error: the coded text the error carries, or else the fallback with
 * the given code and the error's reference.
 */
export function errorText(error: unknown, code: ErrorCode, fallback: string): string {
  if (hasDisplayMessage(error)) {
    return error.displayMessage;
  }
  return formatError(fallback, code, errorRef(error));
}
