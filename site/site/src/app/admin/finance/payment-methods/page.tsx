"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
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
  isPaymentMethodReady,
  PAYMENT_PROVIDER_CURRENCY,
  type PaymentProvider,
} from "@/lib/marketplace/payment-methods-seed";
import { useAdminPaymentMethods, useUpdatePaymentMethod } from "@/queries/admin";

// The at-a-glance overview of every payout rail: which gateway, what it
// settles in, and whether it's actually live. Credentials live on their own
// page at /admin/finance/payment-api — this table is for seeing and
// toggling status, not for entering keys.
export default function AdminPaymentMethodsPage() {
  const methods = useAdminPaymentMethods();
  const update = useUpdatePaymentMethod();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Payment Methods</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payout rail, its currency, and whether it's live. Configure credentials from
          Payment API.
        </p>
      </div>

      {methods.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : methods.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load payment methods. Try again.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gateway</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.data?.paymentMethods.map((m) => {
                const provider = m.provider as PaymentProvider;
                const label = provider.charAt(0).toUpperCase() + provider.slice(1);
                const ready = isPaymentMethodReady(provider, m);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {PAYMENT_PROVIDER_CURRENCY[provider]}
                    </TableCell>
                    <TableCell>
                      <StatusBadge enabled={m.enabled} ready={ready} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Switch
                          checked={m.enabled}
                          onCheckedChange={(v) => update.mutate({ enabled: v, id: m.id })}
                          disabled={!m.enabled && !ready}
                          title={!m.enabled && !ready ? "Set every credential on Payment API before enabling" : undefined}
                          aria-label={`Enable ${label}`}
                        />
                        <Link
                          href="/admin/finance/payment-api"
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          <Pencil className="size-3.5" data-icon="inline-start" /> Configure
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ enabled, ready }: { enabled: boolean; ready: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" />
      Not configured
    </span>
  );
}
