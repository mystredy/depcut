"use client";

import { useLocalImageCache } from "@/lib/useLocalImageCache";

// Drop-in replacement for a plain `<img src>` that paints from a localStorage
// copy on repeat visits — see useLocalImageCache. For non-avatar images (no
// fallback-to-initial needed); UserAvatar covers that case separately.
export function CachedImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const cachedSrc = useLocalImageCache(src, `img:${src}`);
  // eslint-disable-next-line @next/next/no-img-element -- caller-controlled R2/remote bytes, not a Next-optimizable asset
  return <img src={cachedSrc ?? src} alt={alt} className={className} />;
}
