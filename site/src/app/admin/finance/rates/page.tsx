"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdjustCreatorRateInput,
  type AdminCreatorRateAccount,
  useAdjustCreatorRate,
  useAdminFinanceRates,
} from "@/queries/admin";

export default function AdminFinanceRatesPage() {
  const [query, setQuery] = useState("");
  const accounts = useAdminFinanceRates(query);
  const adjust = useAdjustCreatorRate();
  const [target, setTarget] = useState<AdminCreatorRateAccount | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Creator Rates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every creator&apos;s Rates balance. No automated flow credits these yet — balances are
          admin-managed and every change is logged to Transactions.
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
                <TableHead>Creator</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Referral</TableHead>
                <TableHead className="text-right">Lifetime</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.data?.accounts.map((a) => (
                <TableRow key={a.userId}>
                  <TableCell>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-amber-600 dark:text-amber-400">
                    {a.pending.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    {a.available.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{a.referral.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{a.lifetime.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setTarget(a)}>
                      Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.data?.accounts.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={6}>
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {target && (
        <AdjustPanel
          account={target}
          onClose={() => setTarget(null)}
          onSubmit={(input) => adjust.mutate(input, { onSuccess: () => setTarget(null) })}
          pending={adjust.isPending}
        />
      )}
    </div>
  );
}

function AdjustPanel({
  account,
  onClose,
  onSubmit,
  pending,
}: {
  account: AdminCreatorRateAccount;
  onClose: () => void;
  onSubmit: (input: AdjustCreatorRateInput) => void;
  pending: boolean;
}) {
  const [field, setField] = useState<"pending" | "available">("pending");
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState(0);

  return (
    <div className="max-w-xl space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Adjust balance — {account.name}</p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onSubmit({ action: "reset-pending", userId: account.userId })}
        >
          Reset Pending
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onSubmit({ action: "reset-available", userId: account.userId })}
        >
          Reset Available
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || account.pending <= 0}
          onClick={() => onSubmit({ action: "transfer-pending-to-available", userId: account.userId })}
        >
          Transfer Pending → Available
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Target Balance</Label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value as "pending" | "available")}
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
          >
            <option value="pending">Pending Rates</option>
            <option value="available">Available Rates</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "add" | "deduct")}
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
          >
            <option value="add">Add Rates</option>
            <option value="deduct">Deduct Rates</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
        </div>
      </div>

      <Button
        disabled={pending || amount <= 0}
        onClick={() => onSubmit({ action: "adjust", amount, direction, field, userId: account.userId })}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Apply Adjustment
      </Button>
    </div>
  );
}
