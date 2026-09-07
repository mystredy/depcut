"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { AvatarDialog } from "@/app/cut/app/(home)/settings/profile/AvatarDialog";
import { EmailSection } from "@/app/cut/app/(home)/settings/profile/EmailSection";
import { FeatureFlagsSection } from "@/app/cut/app/(home)/settings/profile/FeatureFlagsSection";
import { PreferencesSection } from "@/app/cut/app/(home)/settings/profile/PreferencesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { ApiError } from "@/queries/apiClient";
import {
  useAccountProfile,
  useUpdateDisplayName,
  useUpdateUsername,
  visibleName,
} from "@/queries/accountProfile";

// The account's own page: who you're signed in as, and the one thing about it
// you can change. Every section below fetches its own data independently and
// renders as soon as it's ready — none of them wait on ProfileCard's own
// fetch, so they all load in parallel instead of one after another.
export default function CutProfilePage() {
  return (
    <div className="divide-y pb-9">
      <ProfileCard />
      <PreferencesSection />
      <EmailSection />
      <FeatureFlagsSection />
    </div>
  );
}

// The display name is the product's; the Google account keeps the name and
// email it signed in with.
function ProfileCard() {
  const { data: profile, isPending, isError } = useAccountProfile();
  const update = useUpdateDisplayName();
  const updateUsername = useUpdateUsername();
  // Null means "not edited yet", so the field follows the saved value until
  // the user types and again once a save lands.
  const [draft, setDraft] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
  const [editingAvatar, setEditingAvatar] = useState(false);

  if (isPending) {
    return <Skeleton className="h-[9.75rem] w-full rounded-xl" />;
  }
  if (isError || !profile) {
    return (
      <div className="py-6 first:pt-0">
        <p className="text-sm text-red-600">Couldn&apos;t load your profile.</p>
      </div>
    );
  }

  const value = draft ?? profile.displayName ?? "";
  const dirty = value.trim() !== (profile.displayName ?? "");

  const save = () => {
    update.mutate(value.trim() || null, { onSuccess: () => setDraft(null) });
  };

  const usernameValue = usernameDraft ?? profile.username ?? "";
  const usernameDirty = usernameValue.trim().toLowerCase() !== (profile.username ?? "");
  const usernameError =
    updateUsername.error instanceof ApiError
      ? updateUsername.error.status === 409
        ? "That username is taken."
        : updateUsername.error.message
      : null;

  const saveUsername = () => {
    updateUsername.mutate(usernameValue.trim().toLowerCase() || null, {
      onSuccess: () => setUsernameDraft(null),
    });
  };

  return (
    <>
      <div className="py-6 first:pt-0">
        <div className="flex items-center gap-3">
          {/* The picture is the way into its own editor — pick, frame, save. */}
          <button
            type="button"
            aria-label="Change profile picture"
            onClick={() => setEditingAvatar(true)}
            className="group relative cursor-pointer rounded-lg"
          >
            <UserAvatar
              name={visibleName(profile, profile.name)}
              image={profile.image}
              className="size-[3.6rem]"
              initialClassName="text-lg"
            />
            <span className="absolute inset-0 rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
            {/* Pinned to the corner rather than shown on hover, so the picture
                reads as editable before anyone points at it. */}
            <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
              <Pencil className="size-3" />
            </span>
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {visibleName(profile, profile.name)}
            </div>
            <div className="truncate text-sm text-muted-foreground">{profile.email}</div>
          </div>
        </div>

        <div className="mt-5 border-t pt-5">
          <Label htmlFor="display-name">Display name</Label>
          <div className="mt-3 flex items-center gap-2">
            <Input
              id="display-name"
              className="max-w-xs"
              maxLength={60}
              placeholder={profile.name}
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty) save();
              }}
            />
            <Button disabled={!dirty || update.isPending} onClick={save}>
              Save
            </Button>
          </div>
          {update.isError && (
            <p className="mt-2 text-sm text-red-600">
              Couldn&apos;t save that name — try again.
            </p>
          )}
        </div>

        <div className="mt-5 border-t pt-5">
          <Label htmlFor="username">Username</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            The @handle My Space is identified by — separate from your display name.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <Input
                id="username"
                className="pl-6"
                maxLength={20}
                placeholder="username"
                value={usernameValue}
                onChange={(e) => setUsernameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && usernameDirty) saveUsername();
                }}
              />
            </div>
            <Button disabled={!usernameDirty || updateUsername.isPending} onClick={saveUsername}>
              Save
            </Button>
          </div>
          {usernameError && <p className="mt-2 text-sm text-red-600">{usernameError}</p>}
        </div>
      </div>

      <AvatarDialog
        open={editingAvatar}
        onOpenChange={setEditingAvatar}
        hasCustomImage={profile.image?.startsWith("/api/account/avatar") === true}
      />
    </>
  );
}
