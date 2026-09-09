"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdjustArtistRate, useAdminFinanceRates } from "@/queries/admin";

// Read-only report of every artist's Rates balance — granting, revoking,
// and tier all moved to the Permissions dialog on /admin/users. Only
// scoped to users who currently have (or once had) artist access; see
// /api/admin/finance/rates for how that's filtered.
export default function AdminFinanceRatesPage() {
  const [query, setQuery] = useState("");
  const accounts = useAdminFinanceRates(query);
  const tier = useAdjustArtistRate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Artist Rates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every artist&apos;s Rates balance. Grant, revoke, and tier live on each account&apos;s
          Permissions dialog under Users.
        </p>
      </div>

      <label className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 focus-within:border-ring">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="rounded-2xl border bg-card">
        {accounts.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : accounts.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load balances. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artist</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Referral</TableHead>
                <TableHead className="text-right">Lifetime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.data?.accounts.map((a) => (
                <TableRow key={a.userId} className={!a.active ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{a.name}</p>
                      {!a.active && (
                        <span className="rounded-full border border-destructive/30 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          Revoked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={tier.isPending || !a.active}
                      onClick={() =>
                        tier.mutate({
                          action: "set-tier",
                          tier: a.tier === "Pro" ? "Standard" : "Pro",
                          userId: a.userId,
                        })
                      }
                      className="rounded-full border px-2 py-0.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {a.tier}
                    </button>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-amber-600 dark:text-amber-400">
                    {a.pending.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    {a.available.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{a.referral.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{a.lifetime.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {accounts.data?.accounts.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={6}>
                    No artists found.
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
