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
  useAdminFinanceGiveaways,
  useAdminFinanceRates,
  useCreateGiveaway,
  useUpdateGiveaway,
} from "@/queries/admin";

export default function AdminFinanceGiveawaysPage() {
  const giveaways = useAdminFinanceGiveaways();
  const update = useUpdateGiveaway();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Giveaways</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manually-recorded giveaway prize payouts. No live giveaway system feeds this yet —
            admins record winners here.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" data-icon="inline-start" /> Record Winner
        </Button>
      </div>

      <div className="rounded-2xl border bg-card">
        {giveaways.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : giveaways.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load giveaways. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {giveaways.data?.giveaways.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="text-sm font-medium">{g.userName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{g.topPosition}</TableCell>
                  <TableCell className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {g.reward}
                  </TableCell>
                  <TableCell className="text-xs">{g.status}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{g.paidBy ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {g.status === "Pending" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: g.id, status: "Paid" })}
                        >
                          Approve & Pay
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: g.id, status: "Rejected" })}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Processed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {giveaways.data?.giveaways.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={6}>
                    No giveaway winners recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <RecordWinnerDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function RecordWinnerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useAdminFinanceRates("");
  const create = useCreateGiveaway();

  const [userId, setUserId] = useState("");
  const [topPosition, setTopPosition] = useState("");
  const [reward, setReward] = useState("");

  const submit = () => {
    if (!userId || !topPosition.trim() || !reward.trim()) return;
    create.mutate(
      { reward: reward.trim(), topPosition: topPosition.trim(), userId },
      {
        onSuccess: () => {
          setUserId("");
          setTopPosition("");
          setReward("");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a giveaway winner</DialogTitle>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Position</Label>
            <Input
              value={topPosition}
              onChange={(e) => setTopPosition(e.target.value)}
              placeholder="1st Place"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reward</Label>
            <Input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="$500 Cash Prize" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={create.isPending} onClick={submit}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
