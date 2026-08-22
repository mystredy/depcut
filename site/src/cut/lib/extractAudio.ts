"use client";

import { importFileToProject } from "./media";
import { decodeAudioSpan } from "./mediaRead";
import type { MediaAsset, VideoClip } from "./types";

/** Encode a decoded buffer as 16-bit PCM WAV — the browser has no built-in
 * audio encoder, so extraction writes the container by hand. Interleaved,
 * whatever channel count and sample rate the source decoded at. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const blockAlign = channels * 2;
  const dataSize = buffer.length * blockAlign;

  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  const writeStr = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const data: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) data.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, data[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}

/** Pull a clip's audio out as its own asset in the project's Media — decodes
 * the source file for exactly the clip's trimmed span (clip.in..clip.out,
 * source time, unsped), encodes it to WAV, and imports it like any dropped
 * file: probed for duration and waveform peaks, ready to drop on the
 * soundtrack. Throws if the source has no audio track. */
export async function extractClipAudio(
  projectId: string,
  clip: VideoClip,
  asset: MediaAsset
): Promise<MediaAsset> {
  const buffer = await decodeAudioSpan(asset.url, clip.in, clip.out);
  if (!buffer) throw new Error("This clip has no audio to extract.");
  const wav = audioBufferToWav(buffer);
  const base = asset.name.replace(/\.[^./]+$/, "");
  const file = new File([wav], `${base} — audio.wav`, { type: "audio/wav" });
  const extracted = await importFileToProject(projectId, file);
  if (!extracted) throw new Error("Could not add the extracted audio.");
  return extracted;
}
