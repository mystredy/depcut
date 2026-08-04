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
import {
  useAdminFinanceRates,
  useAdminFinanceReferrals,
  useSettleReferral,
  useUpsertReferral,
} from "@/queries/admin";

export default function AdminFinanceReferralsPage() {
  const referrals = useAdminFinanceReferrals();
  const settle = useSettleReferral();
  const [editing, setEditing] = useState(false);

  const totals = referrals.data?.referrals.reduce(
    (acc, r) => ({
      earned: acc.earned + r.commissionEarned,
      paid: acc.paid + r.commissionPaid,
    }),
    { earned: 0, paid: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Referrals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manually-recorded referral commissions. No referral-tracking system exists yet —
            admins record counts and commissions here.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Plus className="size-3.5" data-icon="inline-start" /> Record Referral Stats
        </Button>
      </div>

      {totals && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Earned</p>
            <p className="text-lg font-bold">${totals.earned.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Paid</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              ${totals.paid.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              ${(totals.earned - totals.paid).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        {referrals.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : referrals.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load referrals. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Expired</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.data?.referrals.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="text-sm font-medium">{r.userName}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.referralCount}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    ${r.commissionEarned.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">${r.commissionPaid.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.activeReferrals}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.expiredReferrals}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={settle.isPending || r.commissionEarned <= r.commissionPaid}
                      onClick={() => settle.mutate(r.userId)}
                    >
                      {r.commissionEarned <= r.commissionPaid ? "Settled" : "Pay Outstanding"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {referrals.data?.referrals.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={7}>
                    No referral records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <RecordReferralDialog open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function RecordReferralDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useAdminFinanceRates("");
  const upsert = useUpsertReferral();

  const [userId, setUserId] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [commissionEarned, setCommissionEarned] = useState(0);
  const [activeReferrals, setActiveReferrals] = useState(0);
  const [expiredReferrals, setExpiredReferrals] = useState(0);

  const submit = () => {
    if (!userId) return;
    upsert.mutate(
      { activeReferrals, commissionEarned, expiredReferrals, referralCount, userId },
      {
        onSuccess: () => {
          setUserId("");
          setReferralCount(0);
          setCommissionEarned(0);
          setActiveReferrals(0);
          setExpiredReferrals(0);
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record referral stats</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">User</Label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Select a user…</option>
              {accounts.data?.accounts.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Referral Count</Label>
              <Input
                type="number"
                value={referralCount}
                onChange={(e) => setReferralCount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Commission Earned ($)</Label>
              <Input
                type="number"
                value={commissionEarned}
                onChange={(e) => setCommissionEarned(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Active Referrals</Label>
              <Input
                type="number"
                value={activeReferrals}
                onChange={(e) => setActiveReferrals(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expired Referrals</Label>
              <Input
                type="number"
                value={expiredReferrals}
                onChange={(e) => setExpiredReferrals(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={upsert.isPending || !userId} onClick={submit}>
            {upsert.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
