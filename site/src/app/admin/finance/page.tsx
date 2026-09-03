"use client";

import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, Coins, Wallet } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatUsd } from "@/lib/credits/format-usd";
import { useAdminFinanceOverview, useAdminUsage } from "@/queries/admin";

export default function AdminFinanceDashboardPage() {
  const overview = useAdminFinanceOverview();
  const data = overview.data;
  // AI credit totals (what accounts hold/earned/spent on inference), not the
  // Rates economy the rest of this page covers — same numbers as /admin/usage.
  const usage = useAdminUsage();
  const creditTotals = usage.data?.totals;

  const pendingUsd = data ? data.totalPendingRates * data.exchangeRate.currentRate : 0;
  const availableUsd = data ? data.totalAvailableRates * data.exchangeRate.currentRate : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Finance Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unified overview of the Rates economy: balances, withdrawals, and payouts.
        </p>
      </div>

      {overview.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : overview.isError || !data ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the overview. Try again.</p>
      ) : (
        <>
          <div className="rounded-2xl border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI Credits
            </p>
            {usage.isLoading ? (
              <Skeleton className="mt-3 h-16 w-full" />
            ) : usage.isError || !creditTotals ? (
              <p className="mt-3 text-sm text-destructive">Couldn&apos;t load AI credit totals.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Wallet className="size-3.5" /> Total Balance
                  </p>
                  <p className="mt-1 text-2xl font-bold">{formatUsd(creditTotals.balance)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Across every account</p>
                </div>
                <div className="sm:border-l sm:pl-6">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    <ArrowDownCircle className="size-3.5" /> Total Received
                  </p>
                  <p className="mt-1 text-2xl font-bold">{formatUsd(creditTotals.lifetimeGranted)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Granted, lifetime</p>
                </div>
                <div className="sm:border-l sm:pl-6">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                    <ArrowUpCircle className="size-3.5" /> Total Spent
                  </p>
                  <p className="mt-1 text-2xl font-bold">{formatUsd(creditTotals.lifetimeCharged)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Charged on AI usage, lifetime</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-gradient-to-r from-emerald-500/5 to-amber-500/5 p-6 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Pending Platform Value
              </p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
                <Coins className="size-5 text-amber-500" />
                {data.totalPendingRates.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground">
                  ≈ ${pendingUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </p>
            </div>
            <div className="md:border-l md:pl-6">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Available Payout Pool
              </p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
                <Coins className="size-5 text-emerald-500" />
                {data.totalAvailableRates.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground">
                  ≈ ${availableUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Pending Withdrawals" value={String(data.withdrawalCounts.pending)} />
            <Stat label="Approved" value={String(data.withdrawalCounts.approved)} />
            <Stat label="Paid Out" value={String(data.withdrawalCounts.paid)} />
            <Stat
              label="Total Creator Payouts"
              value={`$${data.totalCreatorPayouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Economic Ratios
              </p>
              <div className="space-y-2 text-sm">
                <Row label="Current Conversion" value={`1 Rate = $${data.exchangeRate.currentRate}`} />
                <Row
                  label="Example Package"
                  value={`10 Rates = $${(data.exchangeRate.currentRate * 10).toFixed(2)}`}
                />
                <Row label="Effective Date" value={data.exchangeRate.effectiveDate || "—"} />
              </div>
              <Link href="/admin/finance/exchange-rate" className="text-xs font-medium text-primary hover:underline">
                Configure exchange rates →
              </Link>
            </div>

            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Policy Parameters
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Min Withdrawal" value={`${data.settings.minWithdrawal} Rates`} />
                <Row label="Processing Fee" value={`${data.settings.processingFeePct}%`} />
                <Row label="Tax Rate" value={`${data.settings.taxPct}%`} />
                <Row label="Payment Window" value={data.settings.paymentWindow} />
              </div>
              <Link href="/admin/finance/settings" className="text-xs font-medium text-primary hover:underline">
                Alter parameters →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}
