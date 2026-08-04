"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd } from "@/lib/credits/format-usd";
import { useAdminUsage } from "@/queries/admin";

export default function AdminUsagePage() {
  const usage = useAdminUsage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Site-wide AI credit totals and the last 30 days of inference usage.
        </p>
      </div>

      {usage.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : usage.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load usage. Try again.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-6 sm:grid-cols-4">
            <Stat label="Users" value={String(usage.data?.totals.userCount ?? 0)} />
            <Stat label="Balance across accounts" value={formatUsd(usage.data?.totals.balance)} />
            <Stat label="Lifetime granted" value={formatUsd(usage.data?.totals.lifetimeGranted)} />
            <Stat label="Lifetime charged" value={formatUsd(usage.data?.totals.lifetimeCharged)} />
          </div>

          <div className="rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="text-sm font-semibold">Last 30 days by route</p>
                <p className="text-xs text-muted-foreground">
                  Every hosted inference call, grouped by route, provider, and model.
                </p>
              </div>
              <p className="font-mono text-sm">
                {formatUsd(usage.data?.last30Days.totalCharged)} charged
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.data?.last30Days.breakdown.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{row.route}</TableCell>
                    <TableCell className="text-xs">{row.provider}</TableCell>
                    <TableCell className="text-xs">{row.model}</TableCell>
                    <TableCell className="text-right text-sm">{row.count}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {row.failedCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatUsd(row.creditsCharged)}
                    </TableCell>
                  </TableRow>
                ))}
                {usage.data?.last30Days.breakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No inference calls in the last 30 days.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
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
