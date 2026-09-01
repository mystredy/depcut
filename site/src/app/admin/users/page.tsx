"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatUsd } from "@/lib/credits/format-usd";
import { creditTopUpPresetsDollars, maxCreditGrantDollars } from "@/lib/credits/top-up";
import { type AdminUser, useAdminUsers } from "@/queries/admin";
import { useGrantCredits } from "@/queries/credits";

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const users = useAdminUsers(query);
  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Users & Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search accounts, grant credits, and manage super-user access.
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
        {users.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : users.isError ? (
          <p className="p-6 text-sm text-destructive">Couldn&apos;t load users. Try again.</p>
        ) : (
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">User</TableHead>
                <TableHead className="w-20">Balance</TableHead>
                <TableHead className="w-28">Active</TableHead>
                <TableHead className="w-24">Joined</TableHead>
                <TableHead className="w-28">Spent</TableHead>
                <TableHead className="w-28">Received</TableHead>
                <TableHead className="w-16 text-right">Add Fund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data?.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="overflow-hidden">
                    <div className="min-w-0 overflow-hidden">
                      <p className="truncate text-sm font-medium">{u.displayName || u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatUsd(u.balance)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastActiveAt ? timeAgo(u.lastActiveAt) : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {formatUsd(u.lifetimeCharged)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {formatUsd(u.lifetimeGranted)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      title="Grant credits"
                      onClick={() => setGrantTarget(u)}
                    >
                      Grant
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.data?.users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={100} className="py-8 text-center text-sm text-muted-foreground">
                    No users match &quot;{query}&quot;.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <GrantCreditsDialog target={grantTarget} onClose={() => setGrantTarget(null)} />
    </div>
  );
}

function GrantCreditsDialog({
  target,
  onClose,
}: {
  target: AdminUser | null;
  onClose: () => void;
}) {
  const grant = useGrantCredits();
  const [amount, setAmount] = useState(String(creditTopUpPresetsDollars[0] ?? 10));

  const amountDollars = Number(amount);
  const amountValid =
    Number.isInteger(amountDollars) && amountDollars > 0 && amountDollars <= maxCreditGrantDollars;

  const submit = () => {
    if (!target || !amountValid) return;
    grant.mutate(
      { amountDollars, userId: target.id },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant credits</DialogTitle>
          <DialogDescription>
            Add credits to <span className="font-medium">{target?.email}</span>&apos;s balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {creditTopUpPresetsDollars.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={amount === String(preset) ? "default" : "outline"}
                onClick={() => setAmount(String(preset))}
              >
                ${preset}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-grant-amount">Amount (USD)</Label>
            <Input
              id="admin-grant-amount"
              type="number"
              min={1}
              max={maxCreditGrantDollars}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32"
            />
          </div>
          {grant.isError && (
            <p className="text-sm text-destructive">Grant failed. Check the amount and try again.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!amountValid || grant.isPending} onClick={submit}>
            {grant.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Grant ${Number.isFinite(amountDollars) ? amountDollars : 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
