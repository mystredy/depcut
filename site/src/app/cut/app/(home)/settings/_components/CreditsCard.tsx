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

// Strips everything but digits and any leading zeros ("067" -> "67"), so a
// field can never show or submit a zero-padded number. Empty input parses
// to 0 — callers show that as a blank field via `value={n || ""}`, not "0".
function parseWholeNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits === "" ? 0 : Number(digits);
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
  // Dollars, not credits — this is what the API and Stripe actually charge
  // in (see the auto-reload route's z.number().int() on amountDollars), so
  // the field takes a dollar amount directly instead of round-tripping
  // through the cosmetic credit rate.
  const [amountDollars, setAmountDollars] = useState(0);

  // Hydrate local state from the fetched settings exactly once — after
  // that, edits here are the source of truth until Save writes them back.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !autoReload.data) return;
    hydratedRef.current = true;
    setEnabled(autoReload.data.enabled);
    setThresholdCredits(dollarsToCredits(autoReload.data.thresholdDollars, creditRate));
    setAmountDollars(autoReload.data.amountDollars);
  }, [autoReload.data, creditRate]);

  if (autoReload.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const data = autoReload.data;

  // The switch itself is local only — flipping it doesn't call the API.
  // Nothing is real until Save; turning it on still shows on, on its own,
  // right up until a failed Save (e.g. no saved card) reverts it.
  const dirty =
    !data ||
    enabled !== data.enabled ||
    thresholdCredits !== dollarsToCredits(data.thresholdDollars, creditRate) ||
    amountDollars !== data.amountDollars;
  // Turning it on needs a real price before Save is even reachable — no
  // saving an "on" with nothing to charge, and never below the same $5
  // floor the server enforces (creditTopUpMinDollars).
  const needsPrice = enabled && amountDollars < creditTopUpMinDollars;
  const canSave = dirty && !needsPrice && !update.isPending;

  const save = () => {
    if (!canSave) return;
    setNeedsCard(false);
    const next = {
      amountDollars,
      enabled,
      thresholdDollars: creditsToDollars(thresholdCredits, creditRate),
    };
    track("credit_auto_reload_saved", next);
    update.mutate(next, {
      onError: (error) => {
        // Any failed save reverts the toggle — it never silently stays "on"
        // locally while the server still has it off.
        setEnabled(data?.enabled ?? false);
        setNeedsCard(error instanceof ApiError && error.code === "no_payment_method");
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

      {needsCard ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t save: auto-reload needs a saved card.{" "}
          <button
            className="underline underline-offset-4"
            onClick={onNeedsCard}
            type="button"
          >
            Buy credits once
          </button>{" "}
          to save one, then turn this back on.
        </p>
      ) : update.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t save auto-reload. Try again.</p>
      ) : null}

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
              inputMode="numeric"
              min={0}
              onChange={(event) => setThresholdCredits(parseWholeNumber(event.target.value))}
              placeholder="0"
              type="number"
              value={thresholdCredits || ""}
            />
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="reload-amount">
            Automatically buy
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              className="w-24"
              disabled={!enabled}
              id="reload-amount"
              inputMode="numeric"
              min={creditTopUpMinDollars}
              onChange={(event) => setAmountDollars(parseWholeNumber(event.target.value))}
              placeholder="0"
              type="number"
              value={amountDollars || ""}
            />
            <span className="text-sm text-muted-foreground">
              ({dollarsToCredits(amountDollars, creditRate).toLocaleString("en-US")} credits)
            </span>
          </div>
        </div>
        <Button disabled={!canSave} onClick={save} size="sm">
          {update.isPending ? "Saving…" : "Save"}
        </Button>
        {needsPrice ? (
          <p className="text-xs text-muted-foreground">
            Enter at least ${creditTopUpMinDollars} to buy before saving.
          </p>
        ) : null}
      </div>

      {data?.status === "failed" && data.lastError ? (
        <p className="text-sm text-destructive">
          Last auto-reload failed: {data.lastError}
        </p>
      ) : null}
    </div>
  );
}
