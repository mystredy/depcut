"use client";

import { useRouter } from "next/navigation";
import {
  ChartColumn,
  ChevronRight,
  CreditCard,
  EllipsisVertical,
  LogOut,
  Settings,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavStorage } from "@/cut/components/NavStorage";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { formatUsd } from "@/lib/credits/format-usd";
import { openOnboarding } from "@/cut/lib/onboarding";
import { useCutBase } from "@/cut/lib/nav";
import { authClient } from "@/lib/auth-client";
import { useAccountProfile, visibleName } from "@/queries/accountProfile";
import { useCreditBalance } from "@/queries/credits";

// Signed-in user row in the app header; the whole row opens the account
// menu. Hidden while signed out — the editor itself needs no account, so the
// row only surfaces once a session exists.
export function NavUser() {
  const router = useRouter();
  const base = useCutBase();
  const { data: session } = authClient.useSession();
  // Mounted above the session check so the hook order is stable; it stays idle
  // until there's a session to read a profile for.
  const { data: profile, isPending } = useAccountProfile({ enabled: Boolean(session) });
  const credits = useCreditBalance();
  if (!session) return null;

  // The name and picture the user chose live in the profile, not the session.
  // The row waits for them behind a skeleton of its own shape rather than
  // painting the provider's name and swapping it out a beat later.
  if (isPending) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    );
  }

  // The name the user chose wins over the one the provider gave us.
  const name = visibleName(profile, session.user.name);
  const image = profile?.image ?? session.user.image;

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
        {/* The welcome sequence is a full-window overlay mounted in the app
            shell, so this asks for it rather than routing anywhere. */}
        <DropdownMenuItem onClick={openOnboarding}>
          <Sparkles /> View onboarding
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`${base}/settings/profile`)}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
