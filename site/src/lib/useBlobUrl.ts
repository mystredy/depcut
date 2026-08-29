"use client";

import { useEffect, useState } from "react";

/** A blob: URL for the given Blob, recreated when the blob changes and
 * revoked on cleanup — for rendering a stored (e.g. IndexedDB) Blob without
 * leaking object URLs across re-renders. */
export function useBlobUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}
