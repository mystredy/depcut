"use client";

import { Loader2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminFinanceWithdrawals, useBulkPayWithdrawals } from "@/queries/admin";

export default function AdminFinancePayoutQueuePage() {
  const withdrawals = useAdminFinanceWithdrawals();
  const bulkPay = useBulkPayWithdrawals();

  const queued = withdrawals.data?.withdrawals.filter(
    (w) => w.status === "Pending" || w.status === "Approved"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Payout Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending and approved cashout requests waiting to be processed.
          </p>
        </div>
        <Button
          disabled={bulkPay.isPending || !queued?.length}
          onClick={() => bulkPay.mutate()}
        >
          {bulkPay.isPending ? (
            <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <Zap className="size-3.5" data-icon="inline-start" />
          )}
          Bulk Pay All Queued
        </Button>
      </div>

      <div className="rounded-2xl border bg-card">
        {withdrawals.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : withdrawals.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load the queue. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Net Payout</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queued?.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-sm font-medium">{w.userName}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-amber-600 dark:text-amber-400">
                    {w.amountRequested.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    ${w.finalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {w.destination} ({w.method})
                  </TableCell>
                  <TableCell className="text-xs">{w.status}</TableCell>
                </TableRow>
              ))}
              {queued?.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={5}>
                    Nothing queued right now.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
