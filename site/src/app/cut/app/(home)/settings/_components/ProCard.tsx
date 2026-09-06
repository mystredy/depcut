"use client";

import {
  useOpenBillingPortal,
  useProSubscription,
  useStartCheckout,
} from "@/queries/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import { formatUsd } from "@/lib/credits/format-usd";

export function ProCard() {
  const pro = useProSubscription();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();

  if (pro.isLoading) {
    return (
      <div className="space-y-4 py-6 first:pt-0">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const data = pro.data;
  const isActive = data?.isActive ?? false;

  return (
    <div className="space-y-4 py-6 first:pt-0">
      <div className="space-y-1">
        <h2 className="flex items-center gap-3 text-base font-medium">
          DepCut Pro
          {isActive && data ? (
            <Badge variant="default">{data.status}</Badge>
          ) : null}
        </h2>
        <p className="text-sm text-muted-foreground">
          A monthly usage allowance that resets each month — you can still buy
          credits any time.
        </p>
      </div>
      {isActive && data ? (
        <div className="text-sm text-muted-foreground">
          <div className="space-y-1">
            <div className="text-foreground">
              {formatUsd(data.allowanceRemaining)} of{" "}
              {formatUsd(data.monthlyAllowance)} included left this month
            </div>
            <div>
              Renews:{" "}
              {data.currentPeriodEnd
                ? new Date(data.currentPeriodEnd).toLocaleDateString()
                : "—"}
            </div>
            {data.cancelAtPeriodEnd ? (
              <div className="text-foreground">
                Cancels at the end of the current period.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        {isActive ? (
          <Button
            disabled={portal.isPending}
            onClick={() => {
              track("billing_portal_opened");
              portal.mutate(undefined, {
                onSuccess: (result) => window.location.assign(result.url),
              });
            }}
            variant="secondary"
          >
            {portal.isPending ? "Opening…" : "Manage billing"}
          </Button>
        ) : (
          <Button
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
        {checkout.isError || portal.isError ? (
          <span className="text-sm text-destructive">
            Billing is unavailable right now.
          </span>
        ) : null}
      </div>
    </div>
  );
}
