"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Coins, Landmark, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePayoutBalance } from "@/queries/payouts";

type PayoutMethodType = "crypto" | "wise";
type CryptoCurrency = "USDC" | "USDT";

const PAYOUT_METHODS: {
  type: PayoutMethodType;
  name: string;
  badge?: string;
  eta?: string;
  description: string;
  icon: typeof Coins;
  fieldLabel: string;
  fieldPlaceholder: string;
}[] = [
  {
    type: "crypto",
    name: "Crypto Payment",
    badge: "Recommended",
    description: "Crypto helps reduce bank delays so payouts can arrive sooner.",
    icon: Coins,
    fieldLabel: "Wallet address",
    fieldPlaceholder: "0x… or T…",
  },
  {
    type: "wise",
    name: "Wise",
    eta: "2-5 days",
    description: "Wise may charge transfer or conversion fees depending on your country and account.",
    icon: Landmark,
    fieldLabel: "Wise account email",
    fieldPlaceholder: "you@example.com",
  },
];

// The Payout wallet, its totals, and its history below are all real
// (PayoutAccount + Withdrawal via usePayoutBalance) — separate from Artist
// Earnings on /app/artist/my-projects, which is Rates, not USD, and isn't
// itself withdrawable. A creator moves Rates into this wallet explicitly
// from that page; this is the only balance a real Withdrawal ever draws
// down. No payout processor exists yet, though: the method "connect" flow
// below only remembers a wallet address or email locally and never sends
// it anywhere, and there's no way to actually submit a withdrawal request
// from here yet — an admin creates those from /admin/finance/withdrawals.
// Wiring those to a real payout processor is follow-up work.
export default function PayoutsPage() {
  const payout = usePayoutBalance();
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethodType>("crypto");
  const [cryptoCurrency, setCryptoCurrency] = useState<CryptoCurrency>("USDC");
  const [connected, setConnected] = useState<
    { type: PayoutMethodType; value: string; currency?: CryptoCurrency } | null
  >(null);
  const [fieldValue, setFieldValue] = useState("");
  const [connecting, setConnecting] = useState(false);

  const method = PAYOUT_METHODS.find((m) => m.type === selectedMethod)!;

  const connect = () => {
    if (!fieldValue.trim()) return;
    setConnecting(true);
    setTimeout(() => {
      setConnected({
        type: selectedMethod,
        value: fieldValue.trim(),
        currency: selectedMethod === "crypto" ? cryptoCurrency : undefined,
      });
      setConnecting(false);
      setFieldValue("");
    }, 500);
  };

  const connectedMethod = connected && PAYOUT_METHODS.find((m) => m.type === connected.type)!;

  return (
    <div className="divide-y pb-9">
      <div className="py-6 first:pt-0">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Payout Wallet</h2>
          <p className="text-sm text-muted-foreground">
            Rates moved here from Artist Earnings. Only this balance can be withdrawn.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {(
            [
              ["available", "Available for withdrawal"],
              ["lifetime", "Lifetime moved here"],
              ["totalWithdrawn", "Total withdrawn"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              {payout.isPending ? (
                <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
              ) : (
                <div className="text-2xl font-semibold tabular-nums">${(payout.data?.[key] ?? 0).toFixed(2)}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 py-6 first:pt-0">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Payout method</h2>
          <p className="text-sm text-muted-foreground">
            {connectedMethod
              ? "Where your earnings get sent once you cash out."
              : "Choose how you want to receive your earnings. Crypto is recommended for faster payouts."}
          </p>
        </div>
        {connectedMethod ? (
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium">
                  {connectedMethod.name}
                  {connected!.currency && ` · ${connected!.currency}`}
                </p>
                <p className="text-xs text-muted-foreground">{connected!.value}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConnected(null)}>
              Change payout method
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {PAYOUT_METHODS.map((m) => {
                const Icon = m.icon;
                const active = selectedMethod === m.type;
                return (
                  <button
                    key={m.type}
                    type="button"
                    onClick={() => setSelectedMethod(m.type)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                        active ? "border-primary" : "border-muted-foreground/40"
                      )}
                    >
                      {active && <span className="size-1.5 rounded-full bg-primary" />}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{m.name}</span>
                        {m.badge && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            <Sparkles className="size-2.5" />
                            {m.badge}
                          </span>
                        )}
                        {m.eta && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {m.eta}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            {selectedMethod === "crypto" && (
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={cryptoCurrency}
                  onValueChange={(v) => setCryptoCurrency(v as CryptoCurrency)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="payout-field">{method.fieldLabel}</Label>
              <Input
                id="payout-field"
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                placeholder={method.fieldPlaceholder}
              />
            </div>

            <Button
              className="w-full"
              disabled={!fieldValue.trim() || connecting}
              onClick={connect}
            >
              {connecting ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : null}
              Connect
            </Button>

            <p className="flex items-start gap-2 rounded-xl border bg-primary/5 p-3 text-xs text-muted-foreground">
              <Zap className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Crypto is recommended to help ensure faster payments. Wise transfers can take
              longer and may include fees.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 py-6 first:pt-0">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Payout history</h2>
          <p className="text-sm text-muted-foreground">Every withdrawal you&apos;ve requested.</p>
        </div>
        {payout.isPending ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading payout history…
          </div>
        ) : payout.data?.withdrawals.length ? (
          <div className="divide-y rounded-xl border">
            {payout.data.withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">${w.finalAmount.toFixed(2)}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {w.method} · {w.destination} · {new Date(w.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                    w.status === "Paid" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    w.status === "Approved" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                    w.status === "Pending" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    w.status === "Rejected" && "bg-red-500/10 text-red-700 dark:text-red-400"
                  )}
                >
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <Clock className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No payouts yet. They'll show up here once a submission is approved and paid out.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
