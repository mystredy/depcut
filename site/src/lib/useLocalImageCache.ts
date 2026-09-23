"use client";

import { useEffect, useState } from "react";

const CACHE_PREFIX = "depcut:img-cache:v1:";

function readCache(key: string): string | null {
  try {
    return localStorage.getItem(CACHE_PREFIX + key);
  } catch {
    return null;
  }
}

function writeCache(key: string, dataUrl: string) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, dataUrl);
  } catch {
    // Quota exceeded or storage unavailable (private mode) — fine to skip.
  }
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    // Bypass the HTTP cache — the whole point of this store is to hold a
    // copy independent of it, so a stale disk-cache hit here would get
    // baked into localStorage and never self-correct until that entry
    // happened to expire on its own.
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Paints `url` immediately (same as a plain `<img src>`), then — once
 * mounted on the client — swaps in a copy from localStorage if one exists
 * from a previous visit, so a later hard refresh or a cold cache no longer
 * costs a network round trip. Always refetches `url` in the background and
 * updates the stored copy when it changes, so a replaced logo or avatar
 * still catches up eventually.
 */
export function useLocalImageCache(
  url: string | null | undefined,
  cacheKey: string,
): string | null | undefined {
  const [src, setSrc] = useState<string | null | undefined>(url);

  useEffect(() => {
    setSrc(url);
    if (!url) return;

    const cached = readCache(cacheKey);
    if (cached) setSrc(cached);

    let cancelled = false;
    fetchAsDataUrl(url).then((dataUrl) => {
      if (cancelled || !dataUrl || dataUrl === cached) return;
      writeCache(cacheKey, dataUrl);
      setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url, cacheKey]);

  return src;
}
