import { beforeEach, describe, expect, test } from "bun:test";

import { renderElevenLabsClip } from "./tts";

const clipBase64 = btoa("fake-mp3-bytes");

type Call = { url: string; body?: unknown };
let calls: Call[] = [];

// Every scenario below is the same shape: the generate POST behaves one way,
// then (if the client falls back to it) the recovery GET behaves another —
// exercising exactly the path a dropped mobile connection takes through
// postSpeechAsset in tts.ts.
function stubFetch(opts: {
  generate: () => Response | Promise<Response>;
  recover?: () => Response | Promise<Response>;
}) {
  calls = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    calls.push({ url: href, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (href === "/api/inference/assets") return opts.generate();
    if (href.startsWith("/api/inference/assets/recover")) {
      if (!opts.recover) throw new Error("unexpected recovery call");
      return opts.recover();
    }
    throw new Error(`unexpected fetch: ${href}`);
  }) as unknown as typeof fetch;
}

function speechResponse() {
  return new Response(
    JSON.stringify({ outputs: [{ dataBase64: clipBase64, contentType: "audio/mpeg" }] }),
    { status: 201 },
  );
}

describe("renderElevenLabsClip — connection-drop recovery", () => {
  beforeEach(() => {
    calls = [];
  });

  test("a clean generation never touches the recovery endpoint", async () => {
    stubFetch({ generate: () => speechResponse() });
    const { blob } = await renderElevenLabsClip("Hello there", {
      model: "eleven_v3",
      voiceId: "voice-1",
    });
    expect(blob.type).toBe("audio/mpeg");
    expect(calls.map((c) => c.url)).toEqual(["/api/inference/assets"]);
    // The generationId is the same identity the recovery lookup would use.
    expect(typeof (calls[0].body as { generationId?: string }).generationId).toBe("string");
  });

  test("a dropped connection recovers the already-finished result", async () => {
    stubFetch({
      generate: () => {
        throw new TypeError("Load failed");
      },
      recover: () => speechResponse(),
    });
    const { blob } = await renderElevenLabsClip("Hello there", {
      model: "eleven_v3",
      voiceId: "voice-1",
    });
    expect(blob.type).toBe("audio/mpeg");
    const text = await blob.text();
    expect(text).toBe("fake-mp3-bytes");
    // Both retries of the POST (hostedPost's own retry), then the recovery GET.
    expect(calls.filter((c) => c.url === "/api/inference/assets").length).toBe(2);
    expect(calls.some((c) => c.url.startsWith("/api/inference/assets/recover"))).toBe(true);
  });

  test("a dropped connection with nothing to recover reports the drop plainly", async () => {
    stubFetch({
      generate: () => {
        throw new TypeError("Load failed");
      },
      recover: () => new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
    });
    let error: unknown;
    try {
      await renderElevenLabsClip("Hello there", { model: "eleven_v3", voiceId: "voice-1" });
    } catch (e) {
      error = e;
    }
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes("Connection dropped while generating")).toBe(true);
  });

  test("a real provider error (not a dropped connection) is never sent to recovery", async () => {
    stubFetch({
      generate: () =>
        new Response(JSON.stringify({ message: "Speech generation requires a voice id." }), {
          status: 400,
        }),
    });
    let error: unknown;
    try {
      await renderElevenLabsClip("Hello there", { model: "eleven_v3", voiceId: "voice-1" });
    } catch (e) {
      error = e;
    }
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message.includes("voice id")).toBe(true);
    expect(calls.some((c) => c.url.startsWith("/api/inference/assets/recover"))).toBe(false);
  });
});
