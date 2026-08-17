import { Wallet } from "lucide-react";

// No payouts backend exists yet — the creator Payouts page
// (src/app/cut/app/(home)/settings/payouts/page.tsx) only tracks a payout
// method locally in the browser, never sends it anywhere. This page is UI
// scaffolding for once a payouts ledger + processor exist.
export default function AdminPayoutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and process creator payout requests.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-12 text-center">
        <Wallet className="size-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">No payouts backend yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Creators' connected payout methods live only in their own browser right now — there's
            no ledger or payout queue for this page to show. It'll list real payout requests here
            once that's wired up.
          </p>
        </div>
      </div>
    </div>
  );
}
