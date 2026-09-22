import { beforeEach, describe, expect, test } from "bun:test";

import { ConnectionDroppedError, hostedPost } from "./hosted";

type Call = { url: string; body?: unknown };
let calls: Call[] = [];

function stubFetch(responses: (() => Response | Promise<Response>)[]) {
  calls = [];
  let i = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const make = responses[Math.min(i, responses.length - 1)];
    i++;
    return make();
  }) as unknown as typeof fetch;
}

describe("hostedPost", () => {
  beforeEach(() => {
    calls = [];
  });

  test("a connection that stays up needs no retry", async () => {
    stubFetch([() => new Response(JSON.stringify({ ok: true }), { status: 200 })]);
    const res = await hostedPost("/api/inference/assets", { kind: "speech" });
    expect(res.status).toBe(200);
    expect(calls.length).toBe(1);
  });

  // The failure mode this covers: fetch() rejecting outright (a mobile
  // connection dying mid-flight, not a 4xx/5xx) — exactly what showed up as
  // Safari's "Load failed" on a slow ElevenLabs generation.
  test("a one-off dropped connection recovers on the retry", async () => {
    stubFetch([
      () => {
        throw new TypeError("Load failed");
      },
      () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ]);
    const res = await hostedPost("/api/inference/assets", { kind: "speech" });
    expect(res.status).toBe(200);
    expect(calls.length).toBe(2);
    // The retry is the same request, not a different one.
    expect(calls[0].body).toEqual(calls[1].body);
  });

  test("a connection that never comes back throws a distinguishable error", async () => {
    stubFetch([
      () => {
        throw new TypeError("Load failed");
      },
      () => {
        throw new TypeError("Load failed");
      },
    ]);
    let error: unknown;
    try {
      await hostedPost("/api/inference/assets", { kind: "speech" });
    } catch (e) {
      error = e;
    }
    expect(error instanceof ConnectionDroppedError).toBe(true);
    expect(calls.length).toBe(2);
  });

  test("a caller-cancelled request is never retried", async () => {
    stubFetch([
      () => {
        throw new DOMException("The user aborted a request.", "AbortError");
      },
    ]);
    const controller = new AbortController();
    controller.abort();
    let threw = false;
    try {
      await hostedPost("/api/inference/assets", { kind: "speech" }, controller.signal);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(calls.length).toBe(1);
  });

  test("a real 4xx/5xx is not treated as a dropped connection", async () => {
    stubFetch([() => new Response(JSON.stringify({ error: "no credits" }), { status: 402 })]);
    const res = await hostedPost("/api/inference/assets", { kind: "speech" });
    expect(res.status).toBe(402);
    expect(calls.length).toBe(1);
  });
});
