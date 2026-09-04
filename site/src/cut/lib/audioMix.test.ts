import { describe, expect, test } from "bun:test";
import { duckWindows, foldClips, type MixClip, type MixItem } from "./audioMix";

const clip = (over: Partial<MixClip> = {}): MixClip => ({
  file: "a.mp4",
  in: 0,
  out: 4,
  muted: false,
  ...over,
});

const item = (over: Partial<MixItem> = {}): MixItem => ({
  file: "v.mp3",
  in: 0,
  out: 2,
  start: 0,
  volume: 1,
  ...over,
});

describe("foldClips", () => {
  test("lays clips end to end when nothing dissolves", () => {
    const geo = foldClips([clip(), clip(), clip()]);
    expect(geo.map((g) => g.at)).toEqual([0, 4, 8]);
    expect(geo.every((g) => g.fadeIn === 0 && g.fadeOut === 0)).toBe(true);
  });

  test("overlaps the pair by the transition's length either way — audio only actually crosses when asked", () => {
    const geo = foldClips([clip({ transition: 1 }), clip()]);
    expect(geo[0].at).toBe(0);
    // The second clip starts a full transition early — the pair genuinely
    // overlaps, so the cut shortens — for the picture regardless of whether
    // the sound follows it.
    expect(geo[1].at).toBe(3);
    // Off by default: no ramp on either side, just a silent head to trim.
    expect(geo[0].fadeOut).toBe(0);
    expect(geo[1].fadeIn).toBe(0);
    expect(geo[1].silenceHead).toBe(1);
  });

  test("crossfades the audio too when the cut opts in", () => {
    const geo = foldClips([clip({ transition: 1, transitionAudioCrossfade: true }), clip()]);
    expect(geo[1].at).toBe(3);
    expect(geo[0].fadeOut).toBe(1);
    expect(geo[1].fadeIn).toBe(1);
    expect(geo[1].silenceHead).toBe(0);
  });

  test("scales a blend down so it cannot swallow its clip", () => {
    const geo = foldClips([
      clip({ out: 1, transition: 2, transitionAudioCrossfade: true }),
      clip({ out: 1 }),
    ]);
    expect(geo[0].fadeOut).toBeLessThanOrEqual(0.9);
    expect(geo[1].fadeIn).toBe(geo[0].fadeOut);
    expect(geo[1].at).toBeCloseTo(1 - geo[0].fadeOut, 5);
  });

  test("the same clamp applies to the silent-head default", () => {
    const geo = foldClips([clip({ out: 1, transition: 2 }), clip({ out: 1 })]);
    expect(geo[1].silenceHead).toBeLessThanOrEqual(0.9);
    expect(geo[1].at).toBeCloseTo(1 - geo[1].silenceHead, 5);
  });

  test("counts a speed change against the footprint, not the source span", () => {
    expect(foldClips([clip({ out: 4, speed: 2 })])[0].dur).toBeCloseTo(2, 5);
  });

  test("keeps a gap spacer's exact length", () => {
    const geo = foldClips([clip({ file: "", out: 2.5 }), clip()]);
    expect(geo[0].dur).toBeCloseTo(2.5, 5);
    expect(geo[1].at).toBeCloseTo(2.5, 5);
  });

  test("a spacer holds later clips at the time the picture puts them", () => {
    // The fold is sequential, so a gap only stays a gap if it is in the list.
    // Without the spacer the clip lands at 0 and the whole mix runs early.
    const withGap = foldClips([clip({ file: "", out: 3 }), clip()]);
    const without = foldClips([clip()]);
    expect(withGap[1].at).toBeCloseTo(3, 5);
    expect(without[0].at).toBe(0);
  });
});

describe("duckWindows", () => {
  test("has nothing to say when no item ducks", () => {
    expect(duckWindows([item(), item({ duck: 1 })])).toEqual([]);
  });

  test("covers a ducking item's own footprint", () => {
    expect(duckWindows([item({ start: 3, out: 2, duck: 0.2 })])).toEqual([
      { start: 3, end: 5, gain: 0.2 },
    ]);
  });

  test("merges overlapping ducks and takes the deepest", () => {
    const windows = duckWindows([
      item({ start: 0, out: 4, duck: 0.5 }),
      item({ start: 3, out: 4, duck: 0.1 }),
    ]);
    expect(windows).toEqual([{ start: 0, end: 7, gain: 0.1 }]);
  });

  test("keeps separated ducks apart", () => {
    const windows = duckWindows([
      item({ start: 0, out: 1, duck: 0.3 }),
      item({ start: 5, out: 1, duck: 0.4 }),
    ]);
    expect(windows).toHaveLength(2);
    expect(windows[1].start).toBe(5);
  });

  test("measures a ducking item's window through its speed", () => {
    expect(duckWindows([item({ start: 0, out: 4, speed: 2, duck: 0.5 })])[0].end).toBeCloseTo(2, 5);
  });
});
