"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { type AdminUser, type AdminUserAction, useRequestActionCode, useSetSuperUser } from "@/queries/admin";
import { ApiError } from "@/queries/apiClient";

function actionFor(target: AdminUser): AdminUserAction {
  return target.superUser ? "revoke-super-user" : "grant-super-user";
}

// Gates granting/revoking super-user behind a one-time code emailed to the
// acting admin's own address — proof a human with inbox access approved
// this specific action. See lib/admin/action-verification.ts server-side.
export function SuperUserDialog({
  target,
  onClose,
}: {
  target: AdminUser | null;
  onClose: () => void;
}) {
  const requestCode = useRequestActionCode();
  const setSuperUser = useSetSuperUser();
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!target) {
      setChallenge(null);
      setCode("");
      return;
    }
    requestCode.mutate(
      { action: actionFor(target), userId: target.id },
      { onSuccess: (result) => setChallenge(result.challenge) },
    );
    // Only re-fires when the target changes (including to/from null), not on
    // every render the mutations themselves cause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const resend = () => {
    if (!target) return;
    setCode("");
    requestCode.mutate(
      { action: actionFor(target), userId: target.id },
      { onSuccess: (result) => setChallenge(result.challenge) },
    );
  };

  const confirm = () => {
    if (!target || !challenge) return;
    setSuperUser.mutate(
      { challenge, code, superUser: !target.superUser, userId: target.id },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target?.superUser ? "Remove super user access?" : "Make super user?"}
          </DialogTitle>
          <DialogDescription>
            {target?.superUser ? (
              <>
                <span className="font-medium text-foreground">{target.email}</span> will lose
                full admin access to this site.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{target?.email}</span> will get
                full admin access to this site — every admin page, every user&apos;s data, and
                every setting.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {requestCode.isPending && !challenge ? (
          <p className="text-sm text-muted-foreground">Sending a code to your email…</p>
        ) : requestCode.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {requestCode.error instanceof ApiError
                ? requestCode.error.message
                : "Couldn't send a code."}
            </p>
            <Button size="sm" type="button" variant="outline" onClick={resend}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              We emailed a code to {requestCode.data?.sentTo ?? "your email"}.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="super-user-code">Code</Label>
              <Input
                autoFocus
                className="w-28 tracking-widest"
                id="super-user-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                value={code}
              />
            </div>
            {setSuperUser.isError && (
              <p className="text-sm text-destructive">
                {setSuperUser.error instanceof ApiError
                  ? setSuperUser.error.message
                  : "Couldn't update this account."}
              </p>
            )}
            <button
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={resend}
              type="button"
            >
              Resend code
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!challenge || code.length !== 6 || setSuperUser.isPending}
            variant={target?.superUser ? "default" : "destructive"}
            onClick={confirm}
          >
            {setSuperUser.isPending ? (
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : null}
            {target?.superUser ? "Remove super user" : "Make super user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
