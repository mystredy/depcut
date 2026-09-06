"use client";

import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";

import { formatUsd } from "@/lib/credits/format-usd";
import { cn } from "@/lib/utils";
import { useCreditBalance } from "@/queries/credits";

// Ordered so the more specific path wins the suffix match. Billing pins its
// title while the cards scroll; usage lets the title scroll away so the
// table's own pinned column header takes the top of the pane.
const SECTIONS = [
  {
    suffix: "/settings/usage",
    title: "Usage",
    description: "Your AI generation usage this billing period.",
    pinned: false,
    showCredits: true,
  },
  {
    suffix: "/settings/payouts",
    title: "Payouts",
    description: "Payouts to your account.",
    pinned: false,
  },
  {
    suffix: "/settings/profile",
    title: "Profile",
    pinned: true,
  },
  {
    suffix: "/settings",
    title: "Billing",
    description: "Your subscription and credit balance.",
    pinned: true,
  },
];

export function SettingsHeader() {
  const pathname = usePathname();
  // Billing is the settings root, so it's also the fallback title.
  const section =
    SECTIONS.find((s) => pathname.endsWith(s.suffix)) ?? SECTIONS.at(-1)!;
  const credits = useCreditBalance();
  return (
    <div
      className={cn(
        "flex w-full shrink-0 items-start justify-between gap-4 px-3 pt-9 pb-5",
        section.pinned && "sticky top-0 z-20 bg-background",
      )}
    >
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{section.title}</h1>
        {section.description && (
          <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
        )}
      </div>
      {section.showCredits && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5">
          <Zap className="size-3.5 fill-primary text-primary" />
          <span className="text-xs font-medium text-muted-foreground">AI credits</span>
          <span className="font-mono text-xs font-semibold tabular-nums">
            {credits.isLoading ? "…" : formatUsd(credits.data?.balance ?? "0")}
          </span>
        </div>
      )}
    </div>
  );
}
