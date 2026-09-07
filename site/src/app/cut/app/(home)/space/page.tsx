"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clapperboard, Copy, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { authClient } from "@/lib/auth-client";
import { useCutBase } from "@/cut/lib/nav";
import { useAccountProfile, visibleName } from "@/queries/accountProfile";
import { cn } from "@/lib/utils";

type Tab = "published" | "likes";

// A personal space for each account: who you are, and what you've put out
// (Showcase submissions once that's public, likes once liking exists). No
// followers/following graph, no Subscribe banner, no Tasks/Invite/Events —
// those either belong to billing/settings already, or don't exist yet.
// Bio isn't here yet either: there's no column for it on User, only what
// settings/profile already edits for real (display name, avatar).
export default function SpacePage() {
  const base = useCutBase();
  const { data: session } = authClient.useSession();
  const { data: profile } = useAccountProfile();
  const [tab, setTab] = useState<Tab>("published");
  const [copied, setCopied] = useState(false);

  // The layout's SettingsGuard redirects a signed-out visitor before this
  // ever renders; this null render is only the one frame before that fires.
  if (!session) return null;

  const name = visibleName(profile, session.user.name);
  const image = profile?.image ?? session.user.image ?? null;

  const copyId = () => {
    void navigator.clipboard.writeText(session.user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="flex flex-col items-center pt-4 text-center">
        <UserAvatar name={name} image={image} className="size-20 rounded-2xl text-2xl" />
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{name}</h1>
          <button
            type="button"
            onClick={copyId}
            className="flex shrink-0 items-center gap-1 rounded-full border border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "ID"}
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
      </div>

      <div className="flex justify-center gap-1 border-b border-border">
        {(
          [
            { key: "published", label: "Published" },
            { key: "likes", label: "Likes" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-ink text-ink"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "published" ? (
        <div className="grid min-h-[40vh] place-items-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-muted">
              <Clapperboard className="size-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No published projects yet.</p>
            <Button nativeButton={false} render={<Link href={`${base}/creator-hub/submit-project`} />}>
              Submit a project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[40vh] place-items-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-muted">
              <Heart className="size-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No likes yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
