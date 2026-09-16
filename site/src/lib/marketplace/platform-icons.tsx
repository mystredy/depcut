import type { ComponentType } from "react";
import { AtSign, Film, Ghost, Send } from "lucide-react";

import { STUDIO_SOURCE_PLATFORM } from "@/lib/marketplace/oauth-providers";
import { cn } from "@/lib/utils";

// Real per-platform brand marks, each a self-contained rounded-square badge
// (background + glyph) sized entirely by the className passed in — a caller
// just renders <Icon className="size-8" /> with no extra wrapper.
// Facebook/Instagram/X/TikTok get a drawn glyph; YouTube renders Google's
// actual icon asset, since its API terms require the unmodified mark;
// Threads/Snapchat/Telegram reuse their closest Lucide stand-in on the
// platform's real brand color, since their marks aren't simple shapes.
export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="14" fontWeight="700" fontStyle="italic" fill="#fff">
        f
      </text>
    </svg>
  );
}

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#000" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
        X
      </text>
    </svg>
  );
}

// YouTube's API Services terms require the real mark, not a drawn stand-in
// — see /cut/onboarding/youtube.svg, Google's official icon asset.
export function YouTubeIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- fixed-color brand mark, not an optimizable local asset
  return <img src="/cut/onboarding/youtube.svg" alt="" className={className} />;
}

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#000" />
      <circle cx="10" cy="16" r="2.3" fill="#fff" />
      <rect x="12" y="5" width="1.8" height="11" fill="#fff" />
      <path d="M13.8 5c.3 2 1.8 3.4 3.7 3.6v2c-1.4-.1-2.7-.6-3.7-1.4V5Z" fill="#fff" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ig-badge-grad" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-badge-grad)" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="15.7" cy="8.3" r="1" fill="#fff" />
    </svg>
  );
}

export function ThreadsIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-black", className)}>
      <AtSign className="size-[60%] text-white" />
    </div>
  );
}

export function SnapchatIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#FFFC00]", className)}>
      <Ghost className="size-[60%] text-black" />
    </div>
  );
}

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#26A5E4]", className)}>
      <Send className="size-[55%] text-white" />
    </div>
  );
}

export function StudioSourceIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-primary", className)}>
      <Film className="size-[55%] text-primary-foreground" />
    </div>
  );
}

export const PLATFORM_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  snapchat: SnapchatIcon,
  [STUDIO_SOURCE_PLATFORM]: StudioSourceIcon,
  telegram: TelegramIcon,
  threads: ThreadsIcon,
  tiktok: TikTokIcon,
  x: XIcon,
  youtube: YouTubeIcon,
};
