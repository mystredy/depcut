"use client";

import Link from "next/link";
import { Newspaper, Send } from "lucide-react";
import type { ComponentType } from "react";

import { BORDER } from "@/app/cut/_components/landing/dark/theme";

type FooterLink = { href: string; label: string; icon?: ComponentType<{ className?: string }> };
type FooterColumn = { title: string; links: FooterLink[] };

const DISCORD_URL = "https://discord.gg/CPQu5XXmw";
const TELEGRAM_URL = "https://t.me/DepCutbot";

// A plain outline mark (currentColor, no brand background) to sit beside the
// link text — the colored platform badges elsewhere (platform-icons.tsx) are
// for a grid of tappable tiles; this footer just needs a small glyph that
// picks up the same white/50 → white hover the label already does.
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286ZM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.419 2.157-2.419 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.419-2.1569 2.419Zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.419 2.1569-2.419 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419Z" />
    </svg>
  );
}

// Cut's own footer, on the dark landing system. Kept self-contained (not
// the shared _components/landing/Footer) since DepCut Vision, the auth
// screens, and the legal pages still render that one on the cream system.
export function CutFooter() {
  const linkGroups: FooterColumn[] = [
    {
      title: "Product",
      links: [
        { href: "/blog", label: "Blog", icon: Newspaper },
        { href: DISCORD_URL, label: "Discord", icon: DiscordIcon },
        { href: TELEGRAM_URL, label: "Telegram", icon: Send },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/terms", label: "Terms of Use" },
      ],
    },
  ];

  return (
    <footer className="w-full py-16 md:py-20" style={{ borderTop: `1px solid ${BORDER}` }}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 md:flex-row md:flex-wrap md:gap-x-24 md:px-12">
        <div className="min-w-[240px] max-w-sm flex-1">
          <Link href="/" aria-label="DepCut home" className="text-[32px] font-semibold text-white no-underline md:text-[36px]">
            DepCut
          </Link>
          <p className="mt-6 text-[15px] font-medium text-white/70">
            Need help? Join us on{" "}
            <a href={DISCORD_URL} className="text-white underline underline-offset-2">
              Discord
            </a>
          </p>
          <p className="mt-6 text-[13px] text-white/35">2026 DepCut, Inc. Made for Macs.</p>
        </div>
        <div className="flex flex-1 flex-col gap-10 sm:flex-row sm:flex-wrap sm:gap-x-16 sm:gap-y-12 md:gap-x-20">
          {linkGroups.map((group) => {
            const hasIcons = group.links.some((link) => link.icon);
            return (
              <div key={group.title} className="flex min-w-[140px] flex-col gap-4">
                <div className="text-[14px] font-semibold text-white">{group.title}</div>
                <div className={hasIcons ? "flex flex-row flex-wrap gap-x-6 gap-y-3" : "flex flex-col gap-3"}>
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-1.5 text-[14px] text-white/50 no-underline transition-colors hover:text-white"
                    >
                      {link.icon && <link.icon className="size-4" />}
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
