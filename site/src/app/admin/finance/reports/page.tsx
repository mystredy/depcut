"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/marketplace/download-csv";
import {
  useAdminFinanceGiveaways,
  useAdminFinanceRates,
  useAdminFinanceReferrals,
  useAdminFinanceTransactions,
  useAdminFinanceWithdrawals,
} from "@/queries/admin";

export default function AdminFinanceReportsPage() {
  const rates = useAdminFinanceRates("");
  const withdrawals = useAdminFinanceWithdrawals();
  const referrals = useAdminFinanceReferrals();
  const giveaways = useAdminFinanceGiveaways();
  const transactions = useAdminFinanceTransactions({});

  const reports = [
    {
      data: rates.data?.accounts,
      desc: "Every creator's pending, available, referral, and lifetime Rates balance.",
      name: "depcut_creator_rates_summary",
      title: "Creator Rates Summary",
    },
    {
      data: withdrawals.data?.withdrawals,
      desc: "Every requested, approved, and completed creator cashout.",
      name: "depcut_withdrawals_ledger",
      title: "Withdrawals Ledger",
    },
    {
      data: referrals.data?.referrals,
      desc: "Referral counts and commission balances per user.",
      name: "depcut_referral_commissions",
      title: "Referral Commission Logs",
    },
    {
      data: giveaways.data?.giveaways,
      desc: "Recorded giveaway prize winners and payout status.",
      name: "depcut_giveaway_payouts",
      title: "Giveaway Payouts",
    },
    {
      data: transactions.data?.transactions,
      desc: "The full balance-affecting finance event ledger.",
      name: "depcut_finance_transactions",
      title: "Finance Transactions",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export the currently loaded finance data as CSV.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <div key={r.name} className="flex flex-col justify-between gap-3 rounded-2xl border bg-card p-5">
            <div>
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!r.data?.length}
              onClick={() => r.data && downloadCsv(r.data as Record<string, unknown>[], r.name)}
            >
              <Download className="size-3.5" data-icon="inline-start" />
              {r.data?.length ? `Export CSV (${r.data.length} rows)` : "No data yet"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
