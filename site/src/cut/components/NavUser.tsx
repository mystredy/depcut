"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChartColumn,
  ChevronRight,
  Clapperboard,
  CreditCard,
  EllipsisVertical,
  LogOut,
  MessageCircleHeart,
  Monitor,
  Moon,
  Settings,
  Sparkles,
  Sun,
  SunMoon,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreatorApplicationDialog } from "@/cut/components/CreatorApplicationDialog";
import { FeedbackDialog } from "@/cut/components/FeedbackDialog";
import { NavStorage } from "@/cut/components/NavStorage";
import { Skeleton } from "@/components/ui/skeleton";
import { type ThemeChoice, useTheme } from "@/cut/components/ThemeProvider";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { formatUsd } from "@/lib/credits/format-usd";
import { openOnboarding } from "@/cut/lib/onboarding";
import { useCutBase } from "@/cut/lib/nav";
import { authClient } from "@/lib/auth-client";
import { useAccountProfile, visibleName } from "@/queries/accountProfile";
import { useCreditBalance } from "@/queries/credits";

type CachedNavProfile = { name: string; image: string | null };

function navProfileCacheKey(userId: string) {
  return `cut-nav-profile:${userId}`;
}

/** Last visit's resolved name/image for this account, if this browser has
 * one — read synchronously during render (not an effect) so it's there for
 * the very first paint, not a frame after. */
function readCachedNavProfile(userId: string): CachedNavProfile | null {
  try {
    const raw = localStorage.getItem(navProfileCacheKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof (parsed as CachedNavProfile).name === "string"
      ? (parsed as CachedNavProfile)
      : null;
  } catch {
    return null;
  }
}

function writeCachedNavProfile(userId: string, profile: CachedNavProfile) {
  try {
    localStorage.setItem(navProfileCacheKey(userId), JSON.stringify(profile));
  } catch {
    // A private window or full storage just means no instant paint next time.
  }
}

// Signed-in user row in the app header; the whole row opens the account
// menu. Hidden while signed out — the editor itself needs no account, so the
// row only surfaces once a session exists.
export function NavUser() {
  const router = useRouter();
  const base = useCutBase();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [creatorApplicationOpen, setCreatorApplicationOpen] = useState(false);
  const { data: session } = authClient.useSession();
  // Started unconditionally rather than waiting on the session hook to
  // resolve first — /api/account/profile reads the session cookie itself,
  // server-side, so gating it behind the client's own session state only
  // serialized two independent round trips into one that had to finish
  // before the other could start.
  const { data: profile, isPending } = useAccountProfile();
  const credits = useCreditBalance();
  const { theme, setTheme } = useTheme();

  // The name and picture the user chose live in the profile, not the
  // session — resolved only once `profile` actually lands.
  const userId = session?.user.id;
  const resolvedName = profile && session ? visibleName(profile, session.user.name) : null;
  const resolvedImage = profile && session ? (profile.image ?? session.user.image ?? null) : null;

  // Every visit after the first paints this immediately instead of a
  // skeleton, then quietly confirms/updates it once the real fetch lands —
  // the skeleton is left for a browser that's never loaded this account
  // before (or cleared storage). All hooks stay above the session check so
  // the call order never depends on whether one's been reached.
  useEffect(() => {
    if (userId && resolvedName) {
      writeCachedNavProfile(userId, { name: resolvedName, image: resolvedImage });
    }
  }, [userId, resolvedName, resolvedImage]);

  if (!session) return null;

  // The fallback applies whenever there's no resolved name yet — not just
  // while the fetch is still in flight, but also once it's settled with an
  // error (isPending goes false with no data then too).
  const cached = resolvedName ? null : readCachedNavProfile(session.user.id);
  if (isPending && !cached) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    );
  }

  // The name the user chose wins over the one the provider gave us; the
  // cache fills in for a fetch still in flight or one that failed. If
  // neither is available (a first visit whose fetch also failed), fall back
  // to a plain label rather than showing nothing.
  const name = resolvedName ?? cached?.name ?? "Account";
  const image = resolvedImage ?? cached?.image ?? null;

  const signOut = () => {
    // Sign out everywhere: revoke every session for this user (so the Mac app
    // signs out too), then clear this browser's session and land on the Cut
    // landing page. signOut + redirect always run, even if the revoke fails,
    // so the user is never stranded signed-in locally.
    void (async () => {
      try {
        await authClient.revokeSessions();
      } finally {
        await authClient.signOut();
        router.push("/");
      }
    })();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={name}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent data-[popup-open]:bg-sidebar-accent"
        >
          <UserAvatar name={name} image={image} />
          <EllipsisVertical className="size-4 shrink-0 text-sidebar-foreground/70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          {/* The identity row is the way into the profile, where the account's
              details live and the display name is edited. */}
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="gap-2.5 py-2"
              onClick={() => router.push(`${base}/settings/profile`)}
            >
              <UserAvatar name={name} image={image} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <div className="mx-1 my-1.5 flex flex-col gap-2 rounded-lg border bg-muted/50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Zap className="size-3.5 fill-primary text-primary" />
                AI credits
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums">
                {credits.isLoading ? "…" : formatUsd(credits.data?.balance ?? "0")}
              </span>
            </div>
            <Button
              className="h-7 w-full text-xs"
              onClick={() => router.push(`${base}/settings`)}
              size="sm"
              variant="outline"
            >
              Buy / Claim Credits
            </Button>
          </div>
          <NavStorage />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(`${base}/settings`)}>
            <CreditCard /> Billing
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`${base}/settings/usage`)}>
            <ChartColumn /> Usage
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`${base}/settings/payouts`)}>
            <Wallet /> Payouts
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCreatorApplicationOpen(true)}>
            <Clapperboard /> Apply to be creator
          </DropdownMenuItem>
          {/* The welcome sequence is a full-window overlay mounted in the app
              shell, so this asks for it rather than routing anywhere. */}
          <DropdownMenuItem onClick={openOnboarding}>
            <Sparkles /> View onboarding
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`${base}/settings/profile`)}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoon /> Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => setTheme(value as ThemeChoice)}
              >
                <DropdownMenuRadioItem value="light">
                  <Sun /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
            <MessageCircleHeart /> Give feedback
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
      {creatorApplicationOpen && (
        <CreatorApplicationDialog onClose={() => setCreatorApplicationOpen(false)} />
      )}
    </>
  );
}
