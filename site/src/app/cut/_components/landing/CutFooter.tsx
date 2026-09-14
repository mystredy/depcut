"use client";

import Link from "next/link";

import { BORDER } from "@/app/cut/_components/landing/dark/theme";

type FooterLink = { href: string; label: string };
type FooterColumn = { title: string; links: FooterLink[] };

const DISCORD_URL = "https://discord.gg/CPQu5XXmw";
const TELEGRAM_URL = "https://t.me/DepCutbot";

// Cut's own footer, on the dark landing system. Kept self-contained (not
// the shared _components/landing/Footer) since DepCut Vision, the auth
// screens, and the legal pages still render that one on the cream system.
export function CutFooter() {
  const linkGroups: FooterColumn[] = [
    {
      title: "Product",
      links: [
        { href: DISCORD_URL, label: "Discord" },
        { href: TELEGRAM_URL, label: "Telegram" },
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
          {linkGroups.map((group) => (
            <div key={group.title} className="flex min-w-[140px] flex-col gap-4">
              <div className="text-[14px] font-semibold text-white">{group.title}</div>
              <div className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[14px] text-white/50 no-underline transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
