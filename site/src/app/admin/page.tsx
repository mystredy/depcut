"use client";

import Link from "next/link";
import { ArrowRight, Coins, FileCheck2, Send, Users, Wallet } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatUsd } from "@/lib/credits/format-usd";
import { useAdminUsage } from "@/queries/admin";

const SECTIONS = [
  {
    href: "/admin/users",
    title: "Users & Credits",
    description: "Search accounts, grant credits, manage super-user access.",
    icon: Users,
  },
  {
    href: "/admin/usage",
    title: "Usage",
    description: "Site-wide AI spend and the last 30 days of inference calls.",
    icon: Coins,
  },
  {
    href: "/admin/submissions",
    title: "Submissions",
    description: "Review Submit Project submissions.",
    icon: FileCheck2,
  },
  {
    href: "/admin/uploads",
    title: "Uploads & Posts",
    description: "Manually record per-platform publish results for Pro submissions.",
    icon: Send,
  },
  {
    href: "/admin/payouts",
    title: "Payouts",
    description: "Review and process creator payout requests.",
    icon: Wallet,
  },
] as const;

export default function AdminOverviewPage() {
  const usage = useAdminUsage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Site management for Depcut.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-6 sm:grid-cols-5">
        {usage.isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : (
          <>
            <Stat label="Users" value={String(usage.data?.totals.userCount ?? 0)} />
            <Stat
              label="Active (24h)"
              value={String(usage.data?.totals.activeUserCount ?? 0)}
            />
            <Stat label="Balance across accounts" value={formatUsd(usage.data?.totals.balance)} />
            <Stat
              label="Charged, last 30 days"
              value={formatUsd(usage.data?.last30Days.totalCharged)}
            />
            <Stat label="Lifetime granted" value={formatUsd(usage.data?.totals.lifetimeGranted)} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start justify-between gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
