"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
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
        {Number.isFinite(customValue) && customValue > 0 ? (
          <p className="text-xs text-muted-foreground">
            = {dollarsToCredits(customValue, creditRate).toLocaleString("en-US")} credits
            {!customValid
              ? ` (enter an amount between $${creditTopUpMinDollars} and $${creditTopUpMaxDollars})`
              : ""}
          </p>
        ) : null}
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

  const [enabled, setEnabled] = useState(false);
  const [thresholdCredits, setThresholdCredits] = useState(0);
  const [amountCredits, setAmountCredits] = useState(0);

  // Hydrate local state from the fetched settings exactly once — after
  // that, edits here are the source of truth until Save writes them back.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !autoReload.data) return;
    hydratedRef.current = true;
    setEnabled(autoReload.data.enabled);
    setThresholdCredits(dollarsToCredits(autoReload.data.thresholdDollars, creditRate));
    setAmountCredits(dollarsToCredits(autoReload.data.amountDollars, creditRate));
  }, [autoReload.data, creditRate]);

  if (autoReload.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const data = autoReload.data;
  const dirty =
    !data ||
    enabled !== data.enabled ||
    thresholdCredits !== dollarsToCredits(data.thresholdDollars, creditRate) ||
    amountCredits !== dollarsToCredits(data.amountDollars, creditRate);

  const save = () => {
    setNeedsCard(false);
    const next = {
      amountDollars: creditsToDollars(amountCredits, creditRate),
      enabled,
      thresholdDollars: creditsToDollars(thresholdCredits, creditRate),
    };
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
    <div className="space-y-4 border-t pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium" htmlFor="auto-reload-enabled">
            Auto-reload
          </Label>
          <p className="text-xs text-muted-foreground">
            Automatically buy more credits before your balance runs out.
          </p>
        </div>
        <Switch checked={enabled} id="auto-reload-enabled" onCheckedChange={setEnabled} />
      </div>

      <div className={cn("space-y-4 rounded-xl border p-3", !enabled && "opacity-50")}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="reload-threshold">
            Reload when balance drops below
          </Label>
          <div className="flex items-center gap-2">
            <Input
              className="w-28"
              disabled={!enabled}
              id="reload-threshold"
              min={0}
              onChange={(event) => setThresholdCredits(Number(event.target.value) || 0)}
              type="number"
              value={thresholdCredits}
            />
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="reload-amount">
            Automatically buy
          </Label>
          <div className="flex items-center gap-2">
            <Input
              className="w-28"
              disabled={!enabled}
              id="reload-amount"
              min={dollarsToCredits(creditTopUpMinDollars, creditRate)}
              onChange={(event) => setAmountCredits(Number(event.target.value) || 0)}
              type="number"
              value={amountCredits}
            />
            <span className="text-sm text-muted-foreground">
              credits (${creditsToDollars(amountCredits, creditRate).toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      <Button disabled={update.isPending || !dirty} onClick={save} size="sm">
        {update.isPending ? "Saving…" : "Save"}
      </Button>

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
    </div>
  );
}
