"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import {
  useAdminFinanceRates,
  useAdminFinanceWithdrawals,
  useCreateWithdrawal,
  useUpdateWithdrawal,
} from "@/queries/admin";

const STATUS_STYLES: Record<string, string> = {
  Approved: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function AdminFinanceWithdrawalsPage() {
  const withdrawals = useAdminFinanceWithdrawals();
  const update = useUpdateWithdrawal();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Withdrawals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creator cashout requests against their available Rates balance.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" data-icon="inline-start" /> New Withdrawal
        </Button>
      </div>

      <div className="rounded-2xl border bg-card">
        {withdrawals.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : withdrawals.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load withdrawals. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Net Payout</TableHead>
                <TableHead>Method / Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.data?.withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-sm font-medium">{w.userName}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-amber-600 dark:text-amber-400">
                    {w.amountRequested.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    ${w.finalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {w.method} · {w.destination}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                        STATUS_STYLES[w.status]
                      )}
                    >
                      {w.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {w.status === "Pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={update.isPending}
                            onClick={() => update.mutate({ id: w.id, status: "Approved" })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={update.isPending}
                            onClick={() => update.mutate({ id: w.id, status: "Rejected" })}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {(w.status === "Pending" || w.status === "Approved") && (
                        <Button
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: w.id, status: "Paid" })}
                        >
                          Mark Paid
                        </Button>
                      )}
                      {(w.status === "Paid" || w.status === "Rejected") && (
                        <span className="text-xs text-muted-foreground">Settled</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {withdrawals.data?.withdrawals.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={6}>
                    No withdrawal requests yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <NewWithdrawalDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function NewWithdrawalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useAdminFinanceRates("");
  const create = useCreateWithdrawal();

  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("Bank Transfer");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = accounts.data?.accounts.find((a) => a.userId === userId);

  const submit = () => {
    if (!userId || amount <= 0 || !destination.trim()) {
      setError("Pick a creator, an amount, and a destination.");
      return;
    }
    if (selected && amount > selected.available) {
      setError(`Amount exceeds ${selected.name}'s available balance of ${selected.available}.`);
      return;
    }
    setError(null);
    create.mutate(
      { amountRequested: amount, destination: destination.trim(), method, userId },
      {
        onSuccess: () => {
          setUserId("");
          setAmount(0);
          setDestination("");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New withdrawal request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Creator</Label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Select a creator…</option>
              {accounts.data?.accounts.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name} ({a.available.toLocaleString()} available)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount Requested (Rates)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payout Method</Label>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Destination</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Bank account / wallet address"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={create.isPending} onClick={submit}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Create Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
