import { vi } from "vitest";

export type RecordedRequest = { url: string; method: string; headers: Record<string, string>; body: string };

/**
 * A stand-in for the internet. Give it the replies to hand back, in order (or
 * a function), and it records every request the code tried to make.
 */
export function fakeFetch(
  replies: ((request: RecordedRequest) => Response | Promise<Response>) | Response[],
): { fetch: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const queue = Array.isArray(replies) ? [...replies] : null;
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const request: RecordedRequest = {
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      method: (init?.method ?? "GET").toUpperCase(),
      headers,
      body: typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : "",
    };
    requests.push(request);
    if (queue) {
      const next = queue.shift();
      if (!next) throw new Error(`fakeFetch: no reply left for ${request.method} ${request.url}`);
      return next;
    }
    return (replies as (request: RecordedRequest) => Response | Promise<Response>)(request);
  });
  return { fetch: impl as unknown as typeof fetch, requests };
}

export function jsonReply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function decodeBasicAuth(header: string | undefined): string {
  return Buffer.from((header ?? "").replace(/^Basic /, ""), "base64").toString("utf8");
}
