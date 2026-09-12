"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { AvatarDialog } from "@/app/cut/app/(home)/settings/profile/AvatarDialog";
import { EmailSection } from "@/app/cut/app/(home)/settings/profile/EmailSection";
import { FeatureFlagsSection } from "@/app/cut/app/(home)/settings/profile/FeatureFlagsSection";
import { PreferencesSection } from "@/app/cut/app/(home)/settings/profile/PreferencesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateStudioDialog } from "@/cut/components/StudioSwitcher";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { track } from "@/lib/analytics";
import { useAccountProfile, useUpdateDisplayName, visibleName } from "@/queries/accountProfile";
import { useOpenBillingPortal, useProSubscription, useStartCheckout } from "@/queries/billing";

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
  const pro = useProSubscription();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();
  // Null means "not edited yet", so the field follows the saved value until
  // the user types and again once a save lands.
  const [draft, setDraft] = useState<string | null>(null);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [creatingStudio, setCreatingStudio] = useState(false);

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
    update.mutate(value.trim() || null, {
      onSuccess: () => {
        setDraft(null);
        setEditingName(false);
      },
    });
  };
  const cancelEditingName = () => {
    setDraft(null);
    setEditingName(false);
  };

  return (
    <>
      <div className="py-6 first:pt-0">
        <div className="flex flex-wrap items-center gap-3">
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
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  className="h-7 max-w-[200px]"
                  maxLength={60}
                  placeholder={profile.name}
                  value={value}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && dirty) save();
                    if (e.key === "Escape") cancelEditingName();
                  }}
                />
                <Button size="sm" disabled={!dirty || update.isPending} onClick={save}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEditingName}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">
                  {visibleName(profile, profile.name)}
                </span>
                <button
                  type="button"
                  aria-label="Edit display name"
                  onClick={() => setEditingName(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3" />
                </button>
              </div>
            )}
            <div className="truncate text-sm text-muted-foreground">{profile.email}</div>
            {update.isError && (
              <p className="mt-1 text-sm text-red-600">Couldn&apos;t save that name — try again.</p>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {pro.data?.isActive ? (
              <Button
                variant="outline"
                size="sm"
                disabled={portal.isPending}
                onClick={() => {
                  track("billing_portal_opened");
                  portal.mutate(undefined, {
                    onSuccess: (result) => window.location.assign(result.url),
                  });
                }}
              >
                {portal.isPending ? "Opening…" : "Manage billing"}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={checkout.isPending}
                onClick={() => {
                  track("pro_checkout_started");
                  checkout.mutate("pro", {
                    onSuccess: (result) => window.location.assign(result.url),
                  });
                }}
              >
                {checkout.isPending ? "Starting…" : "Subscribe to Pro"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setCreatingStudio(true)}>
              <Plus data-icon="inline-start" className="size-3.5" />
              Create studio
            </Button>
          </div>
        </div>
      </div>

      <AvatarDialog
        open={editingAvatar}
        onOpenChange={setEditingAvatar}
        hasCustomImage={profile.image?.startsWith("/api/account/avatar") === true}
      />
      {creatingStudio && <CreateStudioDialog onClose={() => setCreatingStudio(false)} />}
    </>
  );
}
