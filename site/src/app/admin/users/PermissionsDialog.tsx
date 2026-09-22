"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type AdminUser,
  useAdjustArtistRate,
  useArtistStudioAssignments,
  useAssignArtistStudio,
  useUnassignArtistStudio,
} from "@/queries/admin";
import { ApiError } from "@/queries/apiClient";
import { useStudios } from "@/queries/studio";

import { SuperUserDialog } from "./SuperUserDialog";

/**
 * One place to grant what an account can do: Admin (superUser, via the
 * existing email-code-verified flow — nested here rather than reimplemented)
 * and Artist (grant / Standard-Pro tier, the same actions the Artist Rates
 * page uses).
 */
export function PermissionsDialog({
  target,
  onClose,
}: {
  target: AdminUser | null;
  onClose: () => void;
}) {
  if (!target) return null;
  // Keyed on the target's id so opening a different user (or the same one
  // again after a refetch) gets fresh local state from useState's own
  // initializer, rather than an effect syncing a prop into state.
  return <PermissionsDialogBody key={target.id} target={target} onClose={onClose} />;
}

function PermissionsDialogBody({
  target,
  onClose,
}: {
  target: AdminUser;
  onClose: () => void;
}) {
  const [superUserTarget, setSuperUserTarget] = useState<AdminUser | null>(null);
  const [superUser, setSuperUser] = useState(target.superUser);
  const [isArtist, setIsArtist] = useState(target.isArtist);
  const [tier, setTier] = useState<"Standard" | "Pro">(target.creatorTier === "Pro" ? "Pro" : "Standard");
  const [studiosBusy, setStudiosBusy] = useState(false);
  const grant = useAdjustArtistRate();
  const revoke = useAdjustArtistRate();
  const setTierMutation = useAdjustArtistRate();
  // Blocks Done (and Escape/backdrop dismiss) while any change here is still
  // in flight, so the dialog can't be closed mid-save.
  const busy = grant.isPending || revoke.isPending || setTierMutation.isPending || studiosBusy;

  const doGrant = () => {
    grant.mutate({ action: "grant", userId: target.id }, { onSuccess: () => setIsArtist(true) });
  };

  const doRevoke = () => {
    revoke.mutate({ action: "revoke", userId: target.id }, { onSuccess: () => setIsArtist(false) });
  };

  const toggleTier = () => {
    const next = tier === "Pro" ? "Standard" : "Pro";
    setTierMutation.mutate(
      { action: "set-tier", tier: next, userId: target.id },
      { onSuccess: () => setTier(next) },
    );
  };

  const error = grant.error ?? revoke.error ?? setTierMutation.error;

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissions</DialogTitle>
          </DialogHeader>
          <p className="-mt-3 text-sm text-muted-foreground">{target.email}</p>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-muted-foreground">
                  {superUser ? "Full admin access to this site." : "No admin access."}
                </p>
              </div>
              <Button
                size="sm"
                variant={superUser ? "outline" : "default"}
                onClick={() => setSuperUserTarget({ ...target, superUser })}
              >
                {superUser ? "Remove" : "Grant"}
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Artist</p>
                <p className="text-xs text-muted-foreground">
                  {isArtist
                    ? "Can submit projects, join Inspiration, and reach Payouts."
                    : "No artist access."}
                </p>
              </div>
              {isArtist ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={setTierMutation.isPending}
                    onClick={toggleTier}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {setTierMutation.isPending && (
                      <Loader2 className="mr-1 inline size-3 animate-spin" />
                    )}
                    {tier}
                  </button>
                  <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={doRevoke}>
                    {revoke.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                    ) : null}
                    Remove
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" disabled={grant.isPending} onClick={doGrant}>
                  {grant.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                  ) : null}
                  Grant
                </Button>
              )}
            </div>

            {isArtist && tier === "Pro" && (
              <StudiosSection
                userId={target.id}
                onTierDowngraded={() => setTier("Standard")}
                onBusyChange={setStudiosBusy}
              />
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">
              {error instanceof ApiError ? error.message : "Couldn't update this account."}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SuperUserDialog
        target={superUserTarget}
        onClose={() => setSuperUserTarget(null)}
        onSuccess={setSuperUser}
      />
    </>
  );
}

// Which studios a Pro artist may submit for, and the "code" Telegram command
// generates a code against. Only shown for Pro artists: a Standard
// submission never asks for an edit code at all. The picker only offers
// studios the signed-in admin themselves owns or manages (useStudios) — not
// every studio on the site.
function StudiosSection({
  userId,
  onTierDowngraded,
  onBusyChange,
}: {
  userId: string;
  // Dropping an artist's last studio takes them off Pro too (see the
  // DELETE route) — this syncs the parent's own tier state so the badge
  // and this section (Pro-only) update immediately, not just on reopen.
  onTierDowngraded: () => void;
  // Lets the parent block Done while an add/remove here is still saving.
  onBusyChange: (busy: boolean) => void;
}) {
  const assignments = useArtistStudioAssignments(userId);
  const studios = useStudios();
  const assign = useAssignArtistStudio();
  const unassign = useUnassignArtistStudio();
  const [picked, setPicked] = useState("");

  const busy = assign.isPending || unassign.isPending;
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  const assignedIds = new Set((assignments.data?.assignments ?? []).map((a) => a.studio.id));
  const available = (studios.data?.spaces ?? []).filter((s) => !assignedIds.has(s.id));

  return (
    <div className="rounded-xl border p-3">
      <p className="text-sm font-medium">Studios</p>
      <p className="text-xs text-muted-foreground">Which studios this Pro artist may submit for.</p>

      <div className="mt-2 space-y-1.5">
        {assignments.data?.assignments.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5">
            <span className="text-sm">{a.studio.name}</span>
            <button
              type="button"
              disabled={unassign.isPending}
              onClick={() =>
                unassign.mutate(
                  { studioId: a.studio.id, userId },
                  { onSuccess: (data) => data.tierDowngraded && onTierDowngraded() },
                )
              }
              className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
        {assignments.data?.assignments.length === 0 && (
          <p className="text-xs text-muted-foreground">No studios assigned yet.</p>
        )}
      </div>

      {available.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <Select value={picked} onValueChange={(value) => setPicked(value ?? "")}>
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue placeholder="Add a studio…">
                {(value: string | null) => available.find((s) => s.id === value)?.name ?? "Add a studio…"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {available.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!picked || assign.isPending}
            onClick={() => {
              const studioId = picked;
              setPicked("");
              assign.mutate({ studioId, userId });
            }}
          >
            Add
          </Button>
        </div>
      )}

      {(assign.error || unassign.error) && (
        <p className="mt-2 text-xs text-destructive">
          {assign.error instanceof ApiError
            ? assign.error.message
            : unassign.error instanceof ApiError
              ? unassign.error.message
              : "Couldn't update studios — try again."}
        </p>
      )}
    </div>
  );
}
