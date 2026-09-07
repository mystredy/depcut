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

// No payouts backend exists yet — there's no submissions pipeline to earn
// from, no ledger, and no payout processor wired up. Everything below is
// local UI state: real zero balances (nothing invented), and a payout-method
// "connect" flow that only remembers a wallet address or email locally, never
// sends it anywhere. Wiring this to a real ledger and payout processor is
// follow-up work.
export default function PayoutsPage() {
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
          <h2 className="text-base font-medium">Earnings</h2>
          <p className="text-sm text-muted-foreground">
            What you've earned from approved submissions.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-semibold tabular-nums">$0.00</div>
            <p className="mt-1 text-xs text-muted-foreground">Available</p>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">$0.00</div>
            <p className="mt-1 text-xs text-muted-foreground">Pending review</p>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">$0.00</div>
            <p className="mt-1 text-xs text-muted-foreground">Lifetime earned</p>
          </div>
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
          <p className="text-sm text-muted-foreground">Past payouts to your connected account.</p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <Clock className="size-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No payouts yet. They'll show up here once a submission is approved and paid out.
          </p>
        </div>
      </div>
    </div>
  );
}
