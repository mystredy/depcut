"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { formatUsd } from "@/lib/credits/format-usd";
import { useJoinAffiliateProgram, useMyAffiliate } from "@/queries/affiliate";

export default function AffiliatePage() {
  const { data, isLoading, isError } = useMyAffiliate();

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your affiliate info. Try again.</p>;
  }

  if (!data?.affiliate) {
    return <JoinCard commissionRatePerSignup={data?.commissionRatePerSignup ?? 100} />;
  }

  return <AffiliateDashboard code={data.affiliate.code} stats={data.stats} referrals={data.affiliate.referrals} />;
}

function JoinCard({ commissionRatePerSignup }: { commissionRatePerSignup: number }) {
  const join = useJoinAffiliateProgram();

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
      <Link2 className="size-6 text-primary" />
      <div className="space-y-1">
        <h2 className="text-base font-medium">Join the affiliate program</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Get your own referral link and earn {commissionRatePerSignup} Rates for every new
          account that signs up through it.
        </p>
      </div>
      <Button disabled={join.isPending} onClick={() => join.mutate()}>
        {join.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Get my referral link
      </Button>
    </div>
  );
}

function AffiliateDashboard({
  code,
  stats,
  referrals,
}: {
  code: string;
  stats: { referralCount: number; totalCommissionRates: number; totalCommissionUsd: number };
  referrals: { id: string; referredUserName: string; referredUserImage: string | null; commissionRates: number; createdAt: string }[];
}) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/sign-up?ref=${code}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the link is still
      // visible and selectable, so there's nothing further to do here.
    }
  };

  return (
    <div className="divide-y pb-9">
      <div className="py-6 first:pt-0">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Your referral link</h2>
          <p className="text-sm text-muted-foreground">
            Share it anywhere — you&apos;ll earn a commission for every signup it brings in.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border bg-muted/30 p-3">
          <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? (
              <Check className="size-3.5" data-icon="inline-start" />
            ) : (
              <Copy className="size-3.5" data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="py-6 first:pt-0">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Earnings</h2>
          <p className="text-sm text-muted-foreground">
            Redeemable from Payouts — commissions post automatically, no review needed.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{stats.referralCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">Referrals</p>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{stats.totalCommissionRates}</div>
            <p className="mt-1 text-xs text-muted-foreground">Rates earned</p>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatUsd(String(stats.totalCommissionUsd))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Value</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 py-6 first:pt-0">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Referrals</h2>
          <p className="text-sm text-muted-foreground">Everyone who signed up through your link.</p>
        </div>
        {referrals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <Users className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No referrals yet. Share your link to start earning.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={r.referredUserName} image={r.referredUserImage} className="size-8" />
                  <div>
                    <p className="text-sm font-medium">{r.referredUserName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  +{r.commissionRates} Rates
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
