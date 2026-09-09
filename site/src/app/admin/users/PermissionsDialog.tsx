"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AdminUser, useAdjustCreatorRate } from "@/queries/admin";
import { ApiError } from "@/queries/apiClient";

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
  const grant = useAdjustCreatorRate();
  const setTierMutation = useAdjustCreatorRate();

  const doGrant = () => {
    grant.mutate({ action: "grant", userId: target.id }, { onSuccess: () => setIsArtist(true) });
  };

  const toggleTier = () => {
    const next = tier === "Pro" ? "Standard" : "Pro";
    setTierMutation.mutate(
      { action: "set-tier", tier: next, userId: target.id },
      { onSuccess: () => setTier(next) },
    );
  };

  const error = grant.error ?? setTierMutation.error;

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
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
              ) : (
                <Button size="sm" variant="outline" disabled={grant.isPending} onClick={doGrant}>
                  {grant.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                  ) : null}
                  Grant
                </Button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">
              {error instanceof ApiError ? error.message : "Couldn't update this account."}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
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
