"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

export function CreditsSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [rateCredits, setRateCredits] = useState("1000");
  const [rateDollars, setRateDollars] = useState("3");

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data.settings;
    setRateCredits(String(s.creditRateCredits ?? 1000));
    setRateDollars(String(s.creditRateDollars ?? 3));
  }, [settings.data]);

  const credits = Number.parseInt(rateCredits, 10);
  const dollars = Number.parseInt(rateDollars, 10);
  const valid = Number.isInteger(credits) && credits > 0 && Number.isInteger(dollars) && dollars > 0;

  const save = () => {
    if (!valid) return;
    update.mutate({ creditRateCredits: credits, creditRateDollars: dollars });
  };
  const dirty =
    !!settings.data &&
    (rateCredits !== String(settings.data.settings.creditRateCredits ?? 1000) ||
      rateDollars !== String(settings.data.settings.creditRateDollars ?? 3));

  if (settings.isLoading) return <Skeleton className="h-48 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Display rate</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          How the pay-as-you-go balance displays as &quot;credits&quot; — a display-only
          conversion. Stripe still charges and the ledger still stores real dollars; this
          only sets the number shown on screen.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-sm text-muted-foreground">
        <div className="space-y-1.5">
          <Label htmlFor="credit-rate-credits">Credits</Label>
          <Input
            className="w-28"
            id="credit-rate-credits"
            min={1}
            onChange={(e) => setRateCredits(e.target.value)}
            type="number"
            value={rateCredits}
          />
        </div>
        <span className="pb-2.5">=</span>
        <div className="space-y-1.5">
          <Label htmlFor="credit-rate-dollars">Dollars</Label>
          <Input
            className="w-24"
            id="credit-rate-dollars"
            min={1}
            onChange={(e) => setRateDollars(e.target.value)}
            type="number"
            value={rateDollars}
          />
        </div>
      </div>
      {!valid ? <p className="text-sm text-destructive">Both values must be positive whole numbers.</p> : null}
      <div className="flex justify-end pt-2">
        <Button disabled={update.isPending || !dirty || !valid} onClick={save}>
          {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
