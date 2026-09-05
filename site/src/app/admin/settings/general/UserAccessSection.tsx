"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

export function UserAccessSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [allowRegistration, setAllowRegistration] = useState(true);
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [defaultUserRole, setDefaultUserRole] = useState("User");

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data.settings;
    setAllowRegistration(s.allowRegistration);
    setRequireEmailVerification(s.requireEmailVerification);
    setDefaultUserRole(s.defaultUserRole);
  }, [settings.data]);

  const save = () => {
    update.mutate({ allowRegistration, defaultUserRole, requireEmailVerification });
  };
  const dirty =
    !!settings.data &&
    (allowRegistration !== settings.data.settings.allowRegistration ||
      requireEmailVerification !== settings.data.settings.requireEmailVerification ||
      defaultUserRole !== settings.data.settings.defaultUserRole);

  if (settings.isLoading) return <Skeleton className="h-64 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">User Access</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Who can sign up, and on what terms.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="text-sm font-semibold">Allow New Registrations</p>
          <p className="text-xs text-muted-foreground">
            Turning this off blocks new sign-ups; anyone already signed up keeps signing in.
          </p>
        </div>
        <Switch
          checked={allowRegistration}
          onCheckedChange={setAllowRegistration}
          aria-label="Allow new registrations"
        />
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="text-sm font-semibold">Require Email Verification</p>
          <p className="text-xs text-muted-foreground">
            Sign-in is Google-only right now, and Google accounts are already verified — this
            has nothing to gate until email/password sign-in exists.
          </p>
        </div>
        <Switch
          checked={requireEmailVerification}
          onCheckedChange={setRequireEmailVerification}
          aria-label="Require email verification"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Default User Role</Label>
        <p className="text-xs text-muted-foreground">
          There&apos;s no role system in the product yet (only a super-user flag) — this is stored
          for when one exists.
        </p>
        <Input value={defaultUserRole} onChange={(e) => setDefaultUserRole(e.target.value)} />
      </div>
      <div className="flex justify-end pt-2">
        <Button disabled={update.isPending || !dirty} onClick={save}>
          {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
