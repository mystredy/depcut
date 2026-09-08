"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd } from "@/lib/credits/format-usd";
import {
  useAdminFinanceAffiliates,
  useAdminFinanceSettings,
  useUpdateFinanceSettings,
} from "@/queries/admin";

export default function AdminFinanceAffiliatesPage() {
  const affiliates = useAdminFinanceAffiliates();

  const totals = affiliates.data?.affiliates.reduce(
    (acc, a) => ({
      referrals: acc.referrals + a.referralCount,
      commissionRates: acc.commissionRates + a.totalCommissionRates,
    }),
    { referrals: 0, commissionRates: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Affiliates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every signup is attributed automatically through a referral link — commissions post
          themselves the moment a new account is created.
        </p>
      </div>

      <CommissionRateCard />

      {totals && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Affiliates</p>
            <p className="text-lg font-bold">{affiliates.data?.affiliates.length ?? 0}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Total Referrals
            </p>
            <p className="text-lg font-bold">{totals.referrals}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Total Commission
            </p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {totals.commissionRates} Rates
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        {affiliates.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : affiliates.isError ? (
          <p className="p-4 text-sm text-destructive">Couldn&apos;t load affiliates. Try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.data?.affiliates.map((a) => (
                <TableRow key={a.userId}>
                  <TableCell className="text-sm font-medium">
                    {a.userName}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {a.userEmail}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.code}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{a.referralCount}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    {a.totalCommissionRates} Rates
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {affiliates.data?.affiliates.length === 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground" colSpan={5}>
                    No one has joined the affiliate program yet.
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

function CommissionRateCard() {
  const settings = useAdminFinanceSettings();
  const update = useUpdateFinanceSettings();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (settings.data) setValue(String(settings.data.settings.affiliateCommissionRates));
  }, [settings.data]);

  const dirty =
    settings.data != null && Number(value) !== settings.data.settings.affiliateCommissionRates;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Commission per signup (Rates)</Label>
        <p className="text-xs text-muted-foreground">
          Credited to the affiliate automatically when their referral link brings in a new
          account.
        </p>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40"
          disabled={settings.isLoading}
        />
      </div>
      <Button
        size="sm"
        disabled={!dirty || update.isPending}
        onClick={() =>
          update.mutate({ affiliateCommissionRates: Math.max(0, Number(value) || 0) })
        }
      >
        {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Save
      </Button>
    </div>
  );
}
