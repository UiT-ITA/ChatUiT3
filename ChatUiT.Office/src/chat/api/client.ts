/* global AbortSignal, fetch */

import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses";
import {
  ErrorCodes,
  findUserError,
  refFrom,
  serverError,
  userError,
  errorDetail,
  type UserError,
} from "../../errors/errorCodes";
import { telemetryHeaders, trackError } from "../telemetry/telemetryService";
import type { CreateResponseRequest, StreamEvent } from "./types";

export interface ResponseStream {
  events: AsyncIterable<StreamEvent>;
  /** The server's reference of the request, from its X-ChatUiT-Ref header, or null. */
  ref: string | null;
}

export interface ResponsesClient {
  /**
   * Starts a streamed response. Aborting `signal` cancels the run on the server. Failures, before and
   * during the stream, are thrown as a UserError.
   */
  stream(request: CreateResponseRequest, signal: AbortSignal): Promise<ResponseStream>;
}

export interface ResponsesClientOptions {
  baseURL: string;
  /** Called before every request, so each request carries a fresh token. */
  getToken: () => Promise<string>;
  fetch?: typeof fetch;
}

export function createResponsesClient(options: ResponsesClientOptions): ResponsesClient {
  const openai = new OpenAI({
    baseURL: options.baseURL,
    apiKey: options.getToken,
    dangerouslyAllowBrowser: true,
    // A retried request could commit a confirmed tool twice, because the API is stateless.
    maxRetries: 0,
    fetch: options.fetch,
  });

  return {
    async stream(request, signal) {
      // The wire items include ChatUiT extensions that the SDK types do not know.
      const body = { ...request, stream: true } as unknown as ResponseCreateParamsStreaming;
      try {
        const { data, response } = await openai.responses
          .create(body, { signal, headers: telemetryHeaders() })
          .withResponse();
        const ref = refFrom(response.headers);
        return { events: withUserErrors(data as unknown as AsyncIterable<StreamEvent>, ref), ref };
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        if (error instanceof APIConnectionError) {
          trackError("network", { message: "The request did not reach the server", error });
        }
        throw toUserError(error, null);
      }
    },
  };
}

/** The events, with a failure while reading them thrown as a UserError. */
async function* withUserErrors(events: AsyncIterable<StreamEvent>, ref: string | null): AsyncIterable<StreamEvent> {
  try {
    yield* events;
  } catch (error) {
    throw toUserError(error, ref);
  }
}

/** The UserError for a failure of the SDK. A server text that has an error code is kept as it is. */
function toUserError(error: unknown, streamRef: string | null): UserError {
  const found = findUserError(error);
  if (found) {
    return found;
  }
  if (error instanceof APIConnectionTimeoutError) {
    return userError(ErrorCodes.ConnectionTimedOut, { cause: error });
  }
  if (error instanceof APIConnectionError) {
    return userError(ErrorCodes.ConnectionFailed, { cause: error });
  }
  if (error instanceof APIError) {
    const ref = refFrom(error.headers) ?? streamRef;
    const body: unknown = error.error;
    const text =
      body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : null;
    return serverError(text, fallbackFor(error.status), { ref, cause: error });
  }
  return userError(ErrorCodes.ResponseUnexpected, { ref: streamRef, detail: errorDetail(error), cause: error });
}

/** The add-in's code for an HTTP status, or for a stream error when there is no status. */
function fallbackFor(status: number | undefined) {
  if (status === undefined) {
    return ErrorCodes.StreamError;
  }
  if (status === 401) {
    return ErrorCodes.HttpUnauthorized;
  }
  if (status === 403) {
    return ErrorCodes.HttpForbidden;
  }
  if (status === 404) {
    return ErrorCodes.HttpNotFound;
  }
  if (status === 429) {
    return ErrorCodes.HttpTooManyRequests;
  }
  if (status >= 500) {
    return ErrorCodes.HttpServerError;
  }
  return ErrorCodes.HttpRejected;
}
