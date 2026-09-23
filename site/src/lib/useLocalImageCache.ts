"use client";

import { useEffect, useSyncExternalStore } from "react";

const CACHE_PREFIX = "depcut:img-cache:v1:";

// localStorage has no change event for writes made from this same tab (the
// native `storage` event only fires in other tabs), so components reading
// through useSyncExternalStore below need their own way to be told a key
// they read has a new value — this is that.
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

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
    emitChange();
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

const noCachedValue = () => null;

/**
 * Paints `url` immediately (same as a plain `<img src>`) until a localStorage
 * copy from a previous visit is available, so a later hard refresh or a cold
 * HTTP cache no longer costs a network round trip. Always refetches `url` in
 * the background and updates the stored copy when it changes, so a replaced
 * logo or avatar still catches up eventually.
 */
export function useLocalImageCache(
  url: string | null | undefined,
  cacheKey: string,
): string | null | undefined {
  const cached = useSyncExternalStore(subscribe, () => readCache(cacheKey), noCachedValue);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetchAsDataUrl(url).then((dataUrl) => {
      if (cancelled || !dataUrl || dataUrl === readCache(cacheKey)) return;
      writeCache(cacheKey, dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url, cacheKey]);

  return cached ?? url;
}
