"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminFinanceExchangeRate,
  useAdminFinanceSettings,
  useUpdateFinanceExchangeRate,
  useUpdateFinanceSettings,
} from "@/queries/admin";

export default function AdminFinanceSettingsPage() {
  const settings = useAdminFinanceSettings();
  const update = useUpdateFinanceSettings();

  const [minWithdrawal, setMinWithdrawal] = useState(500);
  const [processingFeePct, setProcessingFeePct] = useState(2.5);
  const [taxPct, setTaxPct] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [paymentWindow, setPaymentWindow] = useState("");
  const [payoutCycle, setPayoutCycle] = useState("");
  const [autoTransferDates, setAutoTransferDates] = useState("");
  const [methodBank, setMethodBank] = useState(true);
  const [methodTonWallet, setMethodTonWallet] = useState(false);
  const [methodStars, setMethodStars] = useState(false);
  const [methodCrypto, setMethodCrypto] = useState(false);

  useEffect(() => {
    const s = settings.data?.settings;
    if (!s) return;
    setMinWithdrawal(s.minWithdrawal);
    setProcessingFeePct(s.processingFeePct);
    setTaxPct(s.taxPct);
    setCurrency(s.currency);
    setPaymentWindow(s.paymentWindow);
    setPayoutCycle(s.payoutCycle);
    setAutoTransferDates(s.autoTransferDates);
    setMethodBank(s.methodBank);
    setMethodTonWallet(s.methodTonWallet);
    setMethodStars(s.methodStars);
    setMethodCrypto(s.methodCrypto);
  }, [settings.data]);

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const exchangeRate = useAdminFinanceExchangeRate();
  const updateRate = useUpdateFinanceExchangeRate();
  const [rate, setRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [rateError, setRateError] = useState<string | null>(null);
  const currentRate = exchangeRate.data?.exchangeRate;

  const applyRate = () => {
    const parsed = Number.parseFloat(rate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateError("Enter a valid exchange rate.");
      return;
    }
    const date = effectiveDate || todayIso();
    setRateError(null);
    updateRate.mutate(
      { effectiveDate: date, rate: parsed },
      {
        onError: () => setRateError("Couldn't update the exchange rate — try again."),
        onSuccess: () => { setRate(""); setEffectiveDate(todayIso()); },
      }
    );
  };

  const save = () => {
    update.mutate({
      autoTransferDates,
      currency,
      methodBank,
      methodCrypto,
      methodStars,
      methodTonWallet,
      minWithdrawal,
      payoutCycle,
      paymentWindow,
      processingFeePct,
      taxPct,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Finance Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Withdrawal minimums, fees, and enabled cashout methods for the Rates economy.
        </p>
      </div>

      {settings.isLoading ? (
        <Skeleton className="h-96 w-full max-w-2xl" />
      ) : settings.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>
      ) : (
        <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Minimum Cashout (Rates)</Label>
              <Input
                type="number"
                value={minWithdrawal}
                onChange={(e) => setMinWithdrawal(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Processing Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={processingFeePct}
                onChange={(e) => setProcessingFeePct(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={taxPct}
                onChange={(e) => setTaxPct(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Base Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Withdrawal Clearing Window</Label>
            <Input value={paymentWindow} onChange={(e) => setPaymentWindow(e.target.value)} />
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Economy Schedule Cycle
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Transfer Schedule Rules</Label>
                <Input value={payoutCycle} onChange={(e) => setPayoutCycle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Auto Transfer Calendar Dates</Label>
                <Input value={autoTransferDates} onChange={(e) => setAutoTransferDates(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Enabled Cashout Methods
            </p>
            {[
              { label: "Bank Transfer", value: methodBank, set: setMethodBank },
              { label: "TON Wallet", value: methodTonWallet, set: setMethodTonWallet },
              { label: "Telegram Stars", value: methodStars, set: setMethodStars },
              { label: "Crypto (USDT/USDC)", value: methodCrypto, set: setMethodCrypto },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">{m.label}</span>
                <Switch checked={m.value} onCheckedChange={m.set} aria-label={m.label} />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button disabled={update.isPending} onClick={save}>
              {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Save Operational Parameters
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exchange Rate
            </p>
            {exchangeRate.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : exchangeRate.isError || !currentRate ? (
              <p className="text-sm text-destructive">Couldn&apos;t load the exchange rate. Try again.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
                  <Sparkles className="size-4 text-primary" />
                  Current: <span className="font-mono font-semibold">1 Rate = ${currentRate.currentRate}</span>
                  <span className="text-muted-foreground">· effective {currentRate.effectiveDate || "—"}</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">New Exchange Rate (1 Rate = $X.XX)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder={String(currentRate.currentRate)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Effective Date</Label>
                    <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  </div>
                </div>

                {rate && !Number.isNaN(Number.parseFloat(rate)) && (
                  <p className="text-xs text-muted-foreground">
                    Preview: 100 Rates = ${(Number.parseFloat(rate) * 100).toFixed(2)}
                  </p>
                )}

                {rateError && <p className="text-sm text-destructive">{rateError}</p>}

                <Button size="sm" variant="outline" disabled={updateRate.isPending} onClick={applyRate}>
                  {updateRate.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
                  Apply & Update Exchange Rate
                </Button>

                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rate Change Log
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conversion Index</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Authorized By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exchangeRate.data?.history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-mono text-xs">1 Rate = ${h.rate.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{h.effectiveDate}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{h.authorName}</TableCell>
                        </TableRow>
                      ))}
                      {exchangeRate.data?.history.length === 0 && (
                        <TableRow>
                          <TableCell className="text-sm text-muted-foreground" colSpan={3}>
                            No changes recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
