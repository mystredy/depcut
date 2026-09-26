import { describe, expect, test } from "bun:test";
import { alignAudio } from "./audioAlign";

function tone(freq: number, seconds: number, sampleRate: number): Float32Array {
  const n = Math.round(seconds * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.8;
  return out;
}

function concat(...parts: Float32Array[]): Float32Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const SR = 8000;

describe("alignAudio", () => {
  test("matches the same melody across a shifted, slower copy", () => {
    // Reference: C4 (0-2s), E4 (2-4s), G4 (4-6s).
    const reference = concat(tone(261.63, 2, SR), tone(329.63, 2, SR), tone(392.0, 2, SR));
    // Compared: a silent 1s lead-in, then the same three notes held longer.
    const compared = concat(
      new Float32Array(SR * 1),
      tone(261.63, 3, SR),
      tone(329.63, 3, SR),
      tone(392.0, 3, SR)
    );

    const result = alignAudio(reference, compared, SR, 1);
    expect(result.points.length).toBeGreaterThan(3);
    expect(result.confidence).toBeGreaterThan(0.6);

    // A point in the middle of the reference's E4 note (t≈3s) should land
    // inside the compared source's own E4 note, now running 4..7s.
    const midE = result.points.find((p) => Math.abs(p.referenceTime - 3) < 0.5);
    expect(midE).toBeTruthy();
    expect(midE!.comparedTime).toBeGreaterThan(3.5);
    expect(midE!.comparedTime).toBeLessThan(7.5);
  });

  test("low confidence for unrelated melodies", () => {
    const reference = concat(tone(261.63, 2, SR), tone(392.0, 2, SR));
    const compared = concat(tone(233.08, 2, SR), tone(174.61, 2, SR)); // unrelated pitches
    const result = alignAudio(reference, compared, SR, 1);
    expect(result.confidence).toBeLessThan(0.6);
  });
});
