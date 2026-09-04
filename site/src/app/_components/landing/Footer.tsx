"use client";

import { Camera, Link as LinkIcon, MessageCircle, Music2, Play, Send, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { GITHUB_REPO_URL } from "@/app/_components/landing/data";
import { usePublicSiteSettings } from "@/queries/site";

// Generic stand-ins, not brand marks: lucide-react dropped its brand icon set
// a while back, and this footer never carried real ones even before — the
// three it always had (LinkedIn, YouTube, Twitter) were already placeholders.
const SOCIAL_ICONS: Record<string, LucideIcon> = {
  discord: MessageCircle,
  facebook: Users,
  instagram: Camera,
  linkedin: LinkIcon,
  tiktok: Music2,
  x: Send,
  youtube: Play,
};

const SOCIAL_LABELS: Record<string, string> = {
  discord: "Discord",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
};

type FooterLink = { href: string; label: string };
type FooterColumn = { title: string; links: FooterLink[] };

// admin/settings/general drives every piece of this: the wordmark, the
// social row (only platforms actually set render at all), the support
// email, legal links (each falls back to the site's own /privacy and
// /terms when unset — Cookie Policy and Help Center only appear once a URL
// is set, since neither has a page of its own here), and the copyright and
// footer lines.
export function Footer() {
  const { data } = usePublicSiteSettings();
  const s = data?.settings;
  const appName = s?.appName ?? "DepCut";

  const socialEntries = Object.entries(s?.socialLinks ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
  );

  const legalLinks: FooterLink[] = [
    { href: s?.privacyUrl || "/privacy", label: "Privacy Policy" },
    { href: s?.termsUrl || "/terms", label: "Terms of Use" },
    ...(s?.cookiePolicyUrl ? [{ href: s.cookiePolicyUrl, label: "Cookie Policy" }] : []),
    ...(s?.helpCenterUrl ? [{ href: s.helpCenterUrl, label: "Help Center" }] : []),
  ];

  const linkGroups: FooterColumn[] = [
    {
      links: [
        { href: "/depcutvision", label: `${appName} Vision API` },
        { href: GITHUB_REPO_URL, label: "GitHub" },
      ],
      title: "Product",
    },
    { links: legalLinks, title: "Legal" },
  ];

  return (
    <footer className="w-full border-t-2 border-ink py-16 md:py-[80px]">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 md:flex-row md:flex-wrap md:gap-x-24 md:px-12">
        <div className="min-w-[240px] max-w-sm flex-1">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <Link
              href="/"
              aria-label={`${appName} home`}
              className="text-[40px] font-semibold text-ink no-underline md:text-[48px]"
            >
              {appName}
            </Link>
            {socialEntries.map(([platform, href]) => {
              const Icon = SOCIAL_ICONS[platform] ?? LinkIcon;
              return (
                <a
                  aria-label={SOCIAL_LABELS[platform] ?? platform}
                  href={href}
                  key={platform}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink bg-white text-ink no-underline"
                >
                  <Icon size={18} />
                </a>
              );
            })}
          </div>
          {s?.supportEmail && (
            <p className="text-[15px] font-semibold text-ink">
              Need help? Email us at{" "}
              <a href={`mailto:${s.supportEmail}`} className="underline underline-offset-2">
                {s.supportEmail}
              </a>
            </p>
          )}
          <p className="mt-6 text-[13px] text-[#666]">
            {s?.copyrightText || `© ${new Date().getFullYear()} ${appName}, Inc.`}
          </p>
          {s?.footerText && <p className="mt-1 text-[13px] text-[#666]">{s.footerText}</p>}
        </div>
        <div className="flex flex-1 flex-col gap-10 sm:flex-row sm:flex-wrap sm:gap-x-16 sm:gap-y-12 md:gap-x-20">
          {linkGroups.map((group) => (
            <div key={group.title} className="flex min-w-[140px] flex-col gap-4">
              <div className="text-[15px] font-semibold text-ink">
                {group.title}
              </div>
              <div className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[15px] text-[#666] no-underline transition-colors hover:text-ink"
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
