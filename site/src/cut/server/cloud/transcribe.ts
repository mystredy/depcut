// Hosted transcription: one short 16 kHz mono WAV chunk in, cue-level
// timestamps out. The client renders the timeline's audible mix, chunks it
// short enough to bound the model's timing drift, and stitches the results
// (lib/cloudTranscribe.ts); this route only turns one chunk of speech into
// cues, metered against the user's inference credits like every
// /api/inference route.
import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";

import {
  creditErrorResponse,
  recordFailedInferenceUsage,
  recordInferenceUsage,
  requireInferenceCredits,
} from "@/lib/credits/inference";
import { elevenLabsModels } from "@/lib/inference/elevenlabs-models";
import { err } from "./util";

// The client sends sub-megabyte chunks of 16-bit mono PCM; anything bigger is
// not ours and would blow past inline-audio comfort anyway.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const ROUTE = "/api/cut-cloud/transcribe/";
const PROVIDER = "elevenlabs";
const MODEL = elevenLabsModels.scribe;
// Cues stay short and speech-paced, matching the subtitle track's own
// rendering rather than Scribe's raw per-word stream.
const MAX_WORDS_PER_CUE = 7;
// A gap this long between two words reads as a natural pause — start a new
// cue there even if the word count hasn't been reached yet.
const PAUSE_SECONDS = 0.6;

interface WireCue {
  start: number;
  end: number;
  text: string;
}

/** Groups Scribe's word-level timings into short, speech-paced cues — the
 * same shape the client (and cueAlign.ts) already expects from this route. */
function groupWordsIntoCues(
  words: { text: string; start?: number; end?: number; type: string }[],
  maxEnd: number,
): WireCue[] {
  const cues: WireCue[] = [];
  let current: { start: number; end: number; texts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.texts.join(" ").replace(/\s+([.,!?;:])/g, "$1").trim();
    if (text) {
      cues.push({
        start: Math.max(0, Math.min(current.start, maxEnd)),
        end: Math.max(0, Math.min(current.end, maxEnd)),
        text,
      });
    }
    current = null;
  };

  for (const word of words) {
    if (word.type !== "word" || typeof word.start !== "number" || typeof word.end !== "number") continue;
    const text = word.text.trim();
    if (!text) continue;

    if (current && word.start - current.end > PAUSE_SECONDS) flush();
    if (!current) current = { start: word.start, end: word.end, texts: [] };

    current.texts.push(text);
    current.end = word.end;

    if (current.texts.length >= MAX_WORDS_PER_CUE || /[.!?]$/.test(text)) flush();
  }
  flush();

  return cues.filter((c) => c.end > c.start).sort((a, b) => a.start - b.start);
}

interface TranscribeExtras {
  tagAudioEvents: boolean;
  diarize: boolean;
  noVerbatim: boolean;
  keyterms: string[];
}

function readExtras(form: FormData): TranscribeExtras {
  return {
    diarize: form.get("diarize") === "true",
    keyterms: form.getAll("keyterms").filter((v): v is string => typeof v === "string" && v.trim().length > 0),
    noVerbatim: form.get("noVerbatim") === "true",
    tagAudioEvents: form.get("tagAudioEvents") === "true",
  };
}

export const transcribeCloud = {
  async transcribe(userId: string, req: Request): Promise<Response> {
    let audio: File | null = null;
    let sourceUrl: string | null = null;
    let locale = "";
    let extras: TranscribeExtras;
    try {
      const form = await req.formData();
      const a = form.get("audio");
      audio = a instanceof File ? a : null;
      const u = form.get("sourceUrl");
      sourceUrl = typeof u === "string" && u.trim() ? u.trim() : null;
      const l = form.get("locale");
      locale = typeof l === "string" ? l.trim() : "";
      extras = readExtras(form);
    } catch {
      return err("Send multipart form data with an audio file.", 400);
    }
    if (!audio && !sourceUrl) return err("Provide an audio file or a source URL.", 400);
    if (audio && sourceUrl) return err("Provide either an audio file or a source URL, not both.", 400);
    if (audio) {
      if (audio.size === 0) return err("Missing audio.", 400);
      if (audio.size > MAX_AUDIO_BYTES) return err("Audio chunk too large.", 413);
    }
    if (sourceUrl) {
      try {
        new URL(sourceUrl);
      } catch {
        return err("That doesn't look like a valid URL.", 400);
      }
    }

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
    if (!apiKey) {
      return err("Transcription is not configured on this deployment.", 500);
    }

    const credits = await requireInferenceCredits({
      enforceModelPrice: true,
      model: MODEL,
      provider: PROVIDER,
      route: ROUTE,
      userId,
    });
    if (!credits.ok) return credits.response;

    // Scribe wants ISO-639-1/3; the client passes BCP-47 locales like "en-US".
    const languageCode = locale ? locale.split("-")[0] : undefined;
    const requestExtras = {
      diarize: extras.diarize || undefined,
      keyterms: extras.keyterms.length ? extras.keyterms : undefined,
      noVerbatim: extras.noVerbatim || undefined,
      tagAudioEvents: extras.tagAudioEvents || undefined,
    };

    let result: Awaited<ReturnType<ElevenLabsClient["speechToText"]["convert"]>>;
    try {
      const client = new ElevenLabsClient({ apiKey });
      result = await client.speechToText.convert(
        sourceUrl
          ? { modelId: MODEL, sourceUrl, languageCode, ...requestExtras }
          : { modelId: MODEL, file: audio!, languageCode, ...requestExtras }
      );
    } catch (error) {
      console.error("[transcribe] provider call failed", {
        body: error instanceof ElevenLabsError ? error.body : undefined,
        message: error instanceof Error ? error.message : String(error),
        sourceUrl: sourceUrl ?? undefined,
        statusCode: error instanceof ElevenLabsError ? error.statusCode : undefined,
      });
      await recordFailedInferenceUsage({
        clientId: null,
        errorCode: "provider_error",
        model: MODEL,
        provider: PROVIDER,
        requestKind: "transcribe",
        route: ROUTE,
        userId,
      });
      const credit = creditErrorResponse(error);
      if (credit) return credit;
      if (error instanceof ElevenLabsError) {
        return err("Transcription failed.", error.statusCode ?? 502);
      }
      return err("Transcription failed.", 502);
    }

    if ("words" in result === false) {
      // Multichannel/webhook response shapes aren't requested by this route.
      return err("The transcription model returned an unreadable response — try again.", 502);
    }

    // Audio chunks arrive in a known fixed format, so their billed duration
    // is estimated from the byte size before the call. A sourceUrl has no
    // local bytes to estimate from — bill from what the provider reports
    // instead, after the call, falling back to the transcript's own span so
    // a real transcription is never billed zero.
    const audioSeconds = audio
      ? Math.max(1, (audio.size - 44) / 32000)
      : result.audioDurationSecs && result.audioDurationSecs > 0
        ? result.audioDurationSecs
        : Math.max(1, ...result.words.map((w) => w.end ?? 0));

    try {
      await recordInferenceUsage({
        clientId: null,
        model: MODEL,
        provider: PROVIDER,
        requestKind: "transcribe",
        route: ROUTE,
        status: "succeeded",
        usage: { durationMillis: Math.round(audioSeconds * 1000) },
        userId,
      });
    } catch (error) {
      const credit = creditErrorResponse(error);
      if (credit) return credit;
      throw error;
    }

    const cues = groupWordsIntoCues(result.words, audioSeconds);
    return Response.json({ cues });
  },
};
