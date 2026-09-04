"use client";

import { useState } from "react";
import { Download } from "lucide-react";

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
import { downloadCsv } from "@/lib/marketplace/download-csv";
import { useAdminFinanceTransactions } from "@/queries/admin";

const TYPES = ["All", "Withdrawal", "Referral", "Giveaway", "Manual Adjustment"];
const STATUSES = ["All", "Completed", "Pending", "Failed"];

export default function AdminFinanceTransactionsPage() {
  const [user, setUser] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const transactions = useAdminFinanceTransactions({
    status: status === "All" ? undefined : status,
    type: type === "All" ? undefined : type,
    user: user || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every balance-affecting finance event, logged automatically.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!transactions.data?.transactions.length}
          onClick={() =>
            transactions.data && downloadCsv(transactions.data.transactions, "depcut_finance_ledger_export")
          }
        >
          <Download className="size-3.5" data-icon="inline-start" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Search user…"
          className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border bg-card">
        {transactions.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : transactions.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load transactions. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Rates</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.data?.transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm font-medium">{tx.userName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{tx.type}</TableCell>
                  <TableCell
                    className={`text-right font-mono text-sm ${
                      tx.ratesAmount > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : tx.ratesAmount < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {tx.ratesAmount === 0 ? "—" : `${tx.ratesAmount > 0 ? "+" : ""}${tx.ratesAmount.toLocaleString()}`}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-sm ${
                      tx.amount > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : tx.amount < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {tx.amount === 0 ? "—" : `${tx.amount > 0 ? "+" : ""}$${Math.abs(tx.amount).toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-xs">{tx.status}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {tx.details}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.data?.transactions.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={6}>
                    No transactions match these filters.
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
