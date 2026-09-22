"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_CREDIT_RATE, dollarsToCredits, type CreditRate } from "@/lib/credits/format-credits";
import { providerMarginDenominator, providerMarginNumerator } from "@/lib/credits/provider-pricing";
import { type AdminProviderPricing, useAdminAiPricing, useAdminSettings } from "@/queries/admin";

const MICROS_PER_DOLLAR = 1_000_000;

// Every rate on this page runs through the same fixed margin (see
// provider-pricing.ts) — there is no per-model override, so this ratio (and
// the % it implies) is identical for every row below, not something
// computed per model.
const MARGIN_NUMERATOR = Number(providerMarginNumerator);
const MARGIN_DENOMINATOR = Number(providerMarginDenominator);
const MARGIN_PERCENT = ((MARGIN_NUMERATOR - MARGIN_DENOMINATOR) / MARGIN_NUMERATOR) * 100;

function baseCostDollars(chargedDollars: number): number {
  return (chargedDollars * MARGIN_DENOMINATOR) / MARGIN_NUMERATOR;
}

function toDollars(micros: string | undefined): number | null {
  if (!micros) return null;
  return Number(micros) / MICROS_PER_DOLLAR;
}

function formatDollars(d: number): string {
  // Full precision for the tiny per-character/per-second rates (they'd
  // round to "$0.00" otherwise); trimmed for the larger ones.
  const fixed = d < 0.01 ? d.toFixed(6) : d.toFixed(2);
  return `$${fixed.replace(/0+$/, "").replace(/\.$/, "")}`;
}

// One line per priced unit a model has (a token model has up to three: input,
// cached input, output). The USD column always shows the true per-unit rate
// (`unitLabel`); `scale`/`scaleLabel` are for the credits column only,
// quoted over a bigger basis so a tiny per-character/per-second rate doesn't
// just round to "0 credits" — it mirrors how a customer would actually rack
// up usage.
type RateLine = {
  unit: string;
  perDollars: number;
  unitLabel: string;
  scale: number;
  scaleLabel: string;
};

function rateLines(pricing: AdminProviderPricing): RateLine[] {
  const lines: RateLine[] = [];
  const add = (unit: string, micros: string | undefined, unitLabel: string, scale: number, scaleLabel: string) => {
    const d = toDollars(micros);
    if (d !== null && d > 0) lines.push({ unit, perDollars: d, unitLabel, scale, scaleLabel });
  };

  add("Input tokens", pricing.inputTokenCostMicrosPerMillion, "1M tokens", 1, "1M tokens");
  add("Cached input tokens", pricing.cachedInputTokenCostMicrosPerMillion, "1M tokens", 1, "1M tokens");
  add("Output tokens", pricing.outputTokenCostMicrosPerMillion, "1M tokens", 1, "1M tokens");
  add("Input audio tokens", pricing.inputAudioTokenCostMicrosPerMillion, "1M tokens", 1, "1M tokens");
  add(
    "Cached input audio tokens",
    pricing.cachedInputAudioTokenCostMicrosPerMillion,
    "1M tokens",
    1,
    "1M tokens",
  );
  add("Output audio tokens", pricing.outputAudioTokenCostMicrosPerMillion, "1M tokens", 1, "1M tokens");
  add("Text input", pricing.characterCostMicros, "character", 1000, "1,000 characters");
  add("Output audio/video", pricing.durationSecondCostMicros, "second", 60, "minute");
  add("Flat per generation", pricing.generationCostMicros, "generation", 1, "generation");

  return lines;
}

function RateRow({
  provider,
  model,
  label,
  pricing,
  creditRate,
}: {
  provider: string;
  model: string;
  label: string;
  pricing: AdminProviderPricing;
  creditRate: CreditRate;
}) {
  const lines = rateLines(pricing);
  const longContextLines = pricing.longContext ? rateLines(pricing.longContext) : [];
  const longContextThreshold = pricing.longContextThresholdTokens
    ? Number(pricing.longContextThresholdTokens).toLocaleString("en-US")
    : null;

  return (
    <TableRow>
      <TableCell className="align-top">
        <p className="text-sm font-medium capitalize">{provider}</p>
      </TableCell>
      <TableCell className="align-top">
        <p className="text-sm font-medium">{label}</p>
        {model && <p className="font-mono text-xs text-muted-foreground">{model}</p>}
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-1">
          {lines.map((l) => (
            <div key={l.unit} className="text-xs">
              <span className="text-muted-foreground">{l.unit}: </span>
              <span className="font-mono">{formatDollars(l.perDollars)}</span>
              <span className="text-muted-foreground"> / {l.unitLabel}</span>
            </div>
          ))}
          {longContextLines.length > 0 && (
            <div className="mt-1.5 border-t pt-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                Long context{longContextThreshold ? ` (>${longContextThreshold} tokens)` : ""}
              </p>
              {longContextLines.map((l) => (
                <div key={l.unit} className="text-xs">
                  <span className="text-muted-foreground">{l.unit}: </span>
                  <span className="font-mono">{formatDollars(l.perDollars)}</span>
                  <span className="text-muted-foreground"> / {l.unitLabel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-1">
          {lines.map((l) => (
            <div key={l.unit} className="text-xs">
              <span className="font-mono">
                {dollarsToCredits(l.perDollars * l.scale, creditRate).toLocaleString("en-US")} credits
              </span>
              <span className="text-muted-foreground"> / {l.scaleLabel}</span>
            </div>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

// Reconstructs each rate's pre-margin base cost (charged rate × the fixed
// margin ratio, in reverse) and the $ profit that leaves — not a real
// invoiced cost, just what the code's own margin implies. The % is the same
// on every row by construction (see MARGIN_PERCENT); what actually varies
// per model is the absolute $ profit.
function ProfitRow({
  provider,
  model,
  label,
  pricing,
}: {
  provider: string;
  model: string;
  label: string;
  pricing: AdminProviderPricing;
}) {
  const lines = rateLines(pricing);
  if (lines.length === 0) return null;

  return (
    <TableRow>
      <TableCell className="align-top">
        <p className="text-sm font-medium capitalize">{provider}</p>
      </TableCell>
      <TableCell className="align-top">
        <p className="text-sm font-medium">{label}</p>
        {model && <p className="font-mono text-xs text-muted-foreground">{model}</p>}
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-1">
          {lines.map((l) => (
            <div key={l.unit} className="text-xs">
              <span className="text-muted-foreground">{l.unit}: </span>
              <span className="font-mono">{formatDollars(baseCostDollars(l.perDollars))}</span>
              <span className="text-muted-foreground"> / {l.unitLabel}</span>
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-1">
          {lines.map((l) => (
            <div key={l.unit} className="text-xs">
              <span className="text-muted-foreground">{l.unit}: </span>
              <span className="font-mono">{formatDollars(l.perDollars)}</span>
              <span className="text-muted-foreground"> / {l.unitLabel}</span>
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-1">
          {lines.map((l) => (
            <div key={l.unit} className="text-xs">
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                +{formatDollars(l.perDollars - baseCostDollars(l.perDollars))}
              </span>
              <span className="text-muted-foreground"> / {l.unitLabel}</span>
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
          +{MARGIN_PERCENT.toFixed(1)}%
        </span>
      </TableCell>
    </TableRow>
  );
}

// Read-only. Every rate here comes straight from providerCreditPricing() —
// the exact function a real generation bills against — via
// listKnownProviderRates(), so this can never show a stale or invented
// number. There is no database override yet; a model's price changes by
// editing provider-pricing.ts.
export default function AdminAiPricingPage() {
  const rates = useAdminAiPricing();
  const settings = useAdminSettings();
  const creditRate: CreditRate = settings.data
    ? {
        credits: settings.data.settings.creditRateCredits,
        dollars: settings.data.settings.creditRateDollars,
      }
    : DEFAULT_CREDIT_RATE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What DepCut charges per model, straight from the rate table every generation actually
          bills against — a 1.3x margin is already applied. The credits column uses the same
          display rate as the customer-facing balance (see AI Credits).
        </p>
      </div>

      <div className="rounded-2xl border bg-card">
        {rates.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : rates.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load pricing. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Rate (USD)</TableHead>
                <TableHead>Rate (credits)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.data?.rates.map((r) => (
                <RateRow
                  key={`${r.provider}:${r.model}`}
                  provider={r.provider}
                  model={r.model}
                  label={r.label}
                  pricing={r.pricing}
                  creditRate={creditRate}
                />
              ))}
              {rates.data?.rates.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={4}>
                    No priced models found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold tracking-tight">Profit / Loss</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Base cost is the charged rate with the margin above backed out — reconstructed from the
          code&apos;s own 1.3x, not a real provider invoice. Every rate in this file runs through
          that same fixed margin, so the % is identical on every row (+{MARGIN_PERCENT.toFixed(1)}%
          gross); what actually differs per model is the $ amount. This only accounts for the AI
          provider&apos;s cost — payment processing, hosting, and everything else aren&apos;t
          priced in here.
        </p>
      </div>

      <div className="rounded-2xl border bg-card">
        {rates.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : rates.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load pricing. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Base cost (assumed)</TableHead>
                <TableHead>Charged</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.data?.rates.map((r) => (
                <ProfitRow
                  key={`${r.provider}:${r.model}:profit`}
                  provider={r.provider}
                  model={r.model}
                  label={r.label}
                  pricing={r.pricing}
                />
              ))}
              {rates.data?.rates.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={6}>
                    No priced models found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
