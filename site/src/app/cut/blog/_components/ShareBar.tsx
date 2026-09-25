"use client";

import { useState } from "react";
import { Check, Copy, Mail, Plus, Share, Share2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FacebookIcon, TelegramIcon, XIcon } from "@/lib/marketplace/platform-icons";
import { cn } from "@/lib/utils";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#25D366]", className)}>
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="#fff" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741 1.352 1.379-3.647-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </div>
  );
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#E60023]", className)}>
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="#fff" aria-hidden="true">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.784c0-1.67.967-2.917 2.171-2.917 1.023 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.283 1.194.6 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.985-5.367 11.985-11.987C24.002 5.367 18.641.001 12.017.001z" />
      </svg>
    </div>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#0A66C2]", className)}>
      <svg viewBox="0 0 24 24" className="size-[55%]" fill="#fff" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    </div>
  );
}

function RedditIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#FF4500]", className)}>
      <svg viewBox="0 0 24 24" className="size-[65%]" fill="#fff" aria-hidden="true">
        <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 013.28 12.6c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.248 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.561-1.249-1.249-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 00.029-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z" />
      </svg>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-neutral-500", className)}>
      <Mail className="size-[55%] text-white" />
    </div>
  );
}

type SharePlatform = {
  key: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
  shareUrl: (url: string, title: string) => string;
};

const SHARE_PLATFORMS: SharePlatform[] = [
  { key: "facebook", label: "Facebook", icon: FacebookIcon, shareUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { key: "x", label: "X", icon: XIcon, shareUrl: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { key: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon, shareUrl: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  { key: "pinterest", label: "Pinterest", icon: PinterestIcon, shareUrl: (url, title) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(title)}` },
  { key: "linkedin", label: "LinkedIn", icon: LinkedInIcon, shareUrl: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { key: "reddit", label: "Reddit", icon: RedditIcon, shareUrl: (url, title) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
  { key: "telegram", label: "Telegram", icon: TelegramIcon, shareUrl: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { key: "email", label: "Email", icon: MailIcon, shareUrl: (url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
];

// The first three platforms shown inline, before the modal's full set —
// whichever a reader is most likely to already have open.
const QUICK_PLATFORMS = SHARE_PLATFORMS.slice(0, 3);

function openShare(platform: SharePlatform, url: string, title: string) {
  const href = platform.shareUrl(url, title);
  if (platform.key === "email") {
    window.location.href = href;
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer,width=600,height=600");
}

export function ShareBar({
  url,
  title,
  variant = "row",
}: {
  url: string;
  title: string;
  // "row": the share icon, a few quick platforms, and a "+" for the rest —
  // used at the bottom of a post. "icon": just the share glyph, for a
  // header byline where the row's platform icons would be too heavy.
  // Both open the exact same modal.
  variant?: "row" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the link is still
      // right there in the field for the reader to select and copy by hand.
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Share this post"
          className="grid size-9 shrink-0 place-items-center text-white/70 transition-colors hover:text-white"
        >
          <Share className="size-5" />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Share this post"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            <Share2 className="size-4" />
          </button>
          {QUICK_PLATFORMS.map((platform) => (
            <button
              key={platform.key}
              type="button"
              onClick={() => openShare(platform, url, title)}
              aria-label={`Share on ${platform.label}`}
            >
              <platform.icon className="size-9" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="More share options"
            className="grid size-9 shrink-0 place-items-center rounded-[25%] border border-white/15 text-white/50 transition-colors hover:border-white/30 hover:text-white"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share to other apps</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-3">
            {SHARE_PLATFORMS.map((platform) => (
              <button
                key={platform.key}
                type="button"
                onClick={() => openShare(platform, url, title)}
                aria-label={`Share on ${platform.label}`}
                className="flex flex-col items-center gap-1.5"
              >
                <platform.icon className="size-12" />
                <span className="text-xs text-muted-foreground">{platform.label}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">Copy post link</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border bg-muted px-2.5 py-2 text-sm text-muted-foreground"
              />
              <button
                type="button"
                onClick={copyLink}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
