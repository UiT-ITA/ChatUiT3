/* global AbortSignal, fetch */

import OpenAI from "openai";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses";
import type { CreateResponseRequest, StreamEvent } from "./types";

export interface ResponsesClient {
  /** Starts a streamed response. Aborting `signal` cancels the run on the server. */
  stream(request: CreateResponseRequest, signal: AbortSignal): Promise<AsyncIterable<StreamEvent>>;
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
      const stream = await openai.responses.create(body, { signal });
      return stream as unknown as AsyncIterable<StreamEvent>;
    },
  };
}
