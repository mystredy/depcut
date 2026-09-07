"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import {
  type CreditRate,
  DEFAULT_CREDIT_RATE,
  creditsToDollars,
  dollarsToCredits,
  formatCredits,
} from "@/lib/credits/format-credits";
import {
  creditTopUpDefaultDollars,
  creditTopUpMaxDollars,
  creditTopUpMinDollars,
  creditTopUpPresetsDollars,
} from "@/lib/credits/top-up";
import { ApiError } from "@/queries/apiClient";
import {
  useCreditAutoReload,
  useCreditBalance,
  useStartCreditCheckout,
  useUpdateCreditAutoReload,
} from "@/queries/credits";
import { usePublicSiteSettings } from "@/queries/site";

export function CreditsCard() {
  const balance = useCreditBalance();
  const checkout = useStartCreditCheckout();
  const [customAmount, setCustomAmount] = useState("");
  const siteSettings = usePublicSiteSettings();
  const creditRate: CreditRate = siteSettings.data
    ? {
        credits: siteSettings.data.settings.creditRateCredits,
        dollars: siteSettings.data.settings.creditRateDollars,
      }
    : DEFAULT_CREDIT_RATE;

  const startCheckout = (amountDollars: number) => {
    track("credits_checkout_started", { amountDollars });
    checkout.mutate(amountDollars, {
      onSuccess: (result) => window.location.assign(result.url),
    });
  };

  const customValue = Number.parseInt(customAmount, 10);
  const customValid =
    Number.isFinite(customValue) &&
    customValue >= creditTopUpMinDollars &&
    customValue <= creditTopUpMaxDollars;

  return (
    <div className="space-y-6 py-6 first:pt-0">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Credits</h2>
        <p className="text-sm text-muted-foreground">
          Pay-as-you-go balance for the DepCut app. Buy more any time.
        </p>
      </div>
      <div>
        {balance.isLoading ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <div className="text-3xl font-semibold tabular-nums">
            {formatCredits(balance.data?.balance ?? "0", creditRate)}
          </div>
        )}
        <p className="mt-1 text-sm text-muted-foreground">Available balance</p>
      </div>

      <div className="space-y-3">
        <Label>Buy credits</Label>
        <div className="flex flex-wrap gap-2">
          {creditTopUpPresetsDollars.map((amount) => (
            <Button
              disabled={checkout.isPending}
              key={amount}
              onClick={() => setCustomAmount(String(amount))}
              variant={customAmount === String(amount) ? "default" : "outline"}
            >
              {dollarsToCredits(amount, creditRate).toLocaleString("en-US")}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground" htmlFor="custom-amount">
              Amount (USD)
            </Label>
            <Input
              className="w-32"
              id="custom-amount"
              inputMode="numeric"
              max={creditTopUpMaxDollars}
              min={creditTopUpMinDollars}
              onChange={(event) => setCustomAmount(event.target.value)}
              placeholder="50"
              type="number"
              value={customAmount}
            />
          </div>
          <Button
            disabled={!customValid || checkout.isPending}
            onClick={() => startCheckout(customValue)}
          >
            {checkout.isPending ? "Starting…" : "Buy"}
          </Button>
        </div>
        {checkout.isError ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t start checkout. Try again in a moment.
          </p>
        ) : null}
      </div>

      <AutoReloadSection
        creditRate={creditRate}
        onNeedsCard={() => startCheckout(creditTopUpDefaultDollars)}
      />
    </div>
  );
}

function AutoReloadSection({
  creditRate,
  onNeedsCard,
}: {
  creditRate: CreditRate;
  onNeedsCard: () => void;
}) {
  const autoReload = useCreditAutoReload();
  const update = useUpdateCreditAutoReload();
  const [needsCard, setNeedsCard] = useState(false);

  if (autoReload.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const data = autoReload.data;
  const enabled = data?.enabled ?? false;

  const save = (next: {
    enabled: boolean;
    thresholdDollars: number;
    amountDollars: number;
  }) => {
    setNeedsCard(false);
    track("credit_auto_reload_saved", next);
    update.mutate(next, {
      onError: (error) => {
        if (error instanceof ApiError && error.code === "no_payment_method") {
          setNeedsCard(true);
        }
      },
    });
  };

  return (
    <form
      className="space-y-3 border-t pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        save({
          amountDollars: creditsToDollars(Number(form.get("amount")), creditRate),
          enabled: form.get("enabled") === "on",
          thresholdDollars: creditsToDollars(Number(form.get("threshold")), creditRate),
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          className="size-4 accent-primary"
          defaultChecked={enabled}
          name="enabled"
          type="checkbox"
        />
        Auto-reload when my balance runs low
      </label>
      <div className="flex flex-wrap items-end gap-3 text-sm text-muted-foreground">
        <span>When balance falls below</span>
        <div className="flex items-center gap-1">
          <Input
            className="w-24"
            defaultValue={dollarsToCredits(data?.thresholdDollars ?? 10, creditRate)}
            min={0}
            name="threshold"
            type="number"
          />
          <span>credits</span>
        </div>
        <span>automatically buy</span>
        <div className="flex items-center gap-1">
          <Input
            className="w-24"
            defaultValue={dollarsToCredits(data?.amountDollars ?? creditTopUpDefaultDollars, creditRate)}
            min={dollarsToCredits(creditTopUpMinDollars, creditRate)}
            name="amount"
            type="number"
          />
          <span>credits</span>
        </div>
        <Button disabled={update.isPending} size="sm" type="submit">
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {data?.status === "failed" && data.lastError ? (
        <p className="text-sm text-destructive">
          Last auto-reload failed: {data.lastError}
        </p>
      ) : null}
      {needsCard ? (
        <p className="text-sm text-muted-foreground">
          Auto-reload needs a saved card.{" "}
          <button
            className="text-primary underline-offset-4 hover:underline"
            onClick={onNeedsCard}
            type="button"
          >
            Buy credits once
          </button>{" "}
          to save one, then turn this on.
        </p>
      ) : null}
    </form>
  );
}
