"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useElapsed } from "./useElapsed";

export type MicRecorderState = "idle" | "recording" | "stopping";

/** Plain browser mic capture for a page with no project/local engine to
 * prefer — request permission, record, and hand back a finished Blob on
 * stop. No live transcript; the caller transcribes the whole take at once. */
export function useMicRecorder() {
  const [state, setState] = useState<MicRecorderState>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsed = useElapsed(startedAt);

  const start = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. Allow the microphone for this site, then try again.");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start();
    recorderRef.current = rec;
    setStartedAt(Date.now());
    setState("recording");
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec) return Promise.resolve(null);
    setState("stopping");
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStartedAt(null);
        setState("idle");
        resolve(blob);
      };
      rec.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    chunksRef.current = [];
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // Already stopping; nothing to discard.
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStartedAt(null);
    setState("idle");
  }, []);

  // Abandon a recording if the page unmounts mid-take.
  useEffect(() => () => cancel(), [cancel]);

  return { state, elapsed, error, start, stop, cancel };
}
