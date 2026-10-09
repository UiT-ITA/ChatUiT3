/* global fetch, Headers, ReadableStream, Request, RequestInit, Response, TextEncoder, URL */

/**
 * A fake ChatUiT `/api/v1/responses` endpoint. Each request is answered with the next scripted
 * event list, sent as SSE and split across chunks, and every request is recorded.
 */

export type ScriptedEvent = { type: string } & Record<string, unknown>;

export interface RecordedRequest {
  url: string;
  method: string;
  authorization: string | null;
  body: Record<string, unknown>;
}

export interface MockServer {
  fetch: typeof fetch;
  requests: RecordedRequest[];
}

export function mockServer(script: ScriptedEvent[][]): MockServer {
  const requests: RecordedRequest[] = [];
  let next = 0;

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    requests.push({
      url,
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });

    const events = script[next];
    next += 1;
    if (!events) {
      return new Response(
        JSON.stringify({ error: { message: "No scripted response left.", type: "fixture", param: null, code: null } }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(sseBody(events), { status: 200, headers: { "content-type": "text/event-stream" } });
  };

  return { fetch: fetchImpl as typeof fetch, requests };
}

function sseBody(events: ScriptedEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  events.forEach((event, sequence) => {
    const frame = `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number: sequence })}\n\n`;
    // Split every frame, so the client has to join partial chunks.
    const middle = Math.floor(frame.length / 2);
    chunks.push(frame.slice(0, middle), frame.slice(middle));
  });
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/** Builders for the scripted events, following the wire contract. */
export const sse = {
  created: (): ScriptedEvent => ({ type: "response.created", response: response("in_progress", []) }),
  inProgress: (): ScriptedEvent => ({ type: "response.in_progress", response: response("in_progress", []) }),
  completed: (output: unknown[]): ScriptedEvent => ({
    type: "response.completed",
    response: response("completed", output),
  }),
  itemAdded: (index: number, item: Record<string, unknown>): ScriptedEvent => ({
    type: "response.output_item.added",
    output_index: index,
    item,
  }),
  itemDone: (index: number, item: Record<string, unknown>): ScriptedEvent => ({
    type: "response.output_item.done",
    output_index: index,
    item,
  }),
  /** The full event sequence of one streamed assistant text message. */
  textMessage: (index: number, id: string, deltas: string[]): ScriptedEvent[] => {
    const text = deltas.join("");
    const part = { type: "output_text", text, annotations: [] };
    const done = { type: "message", id, role: "assistant", status: "completed", content: [part] };
    return [
      sse.itemAdded(index, { type: "message", id, role: "assistant", status: "in_progress", content: [] }),
      {
        type: "response.content_part.added",
        output_index: index,
        content_index: 0,
        item_id: id,
        part: { type: "output_text", text: "", annotations: [] },
      },
      ...deltas.map((delta) => ({
        type: "response.output_text.delta",
        output_index: index,
        content_index: 0,
        item_id: id,
        delta,
      })),
      { type: "response.output_text.done", output_index: index, content_index: 0, item_id: id, text },
      { type: "response.content_part.done", output_index: index, content_index: 0, item_id: id, part },
      sse.itemDone(index, done),
    ];
  },
  messageItem: (id: string, text: string) => ({
    type: "message",
    id,
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  }),
};

function response(status: string, output: unknown[]) {
  return {
    id: "resp_fixture",
    object: "response",
    created_at: 1790000000,
    status,
    model: "office",
    output,
    usage: null,
  };
}
