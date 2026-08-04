"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  PAYMENT_PROVIDER_DESCRIPTIONS,
  type PaymentProvider,
} from "@/lib/marketplace/payment-methods-seed";
import {
  type AdminPaymentMethod,
  useAdminPaymentMethods,
  useUpdatePaymentMethod,
} from "@/queries/admin";

// Site-wide payout rails: which providers are turned on, and their
// credentials. Toggling one on here is what makes it show up as an option on
// the creator-facing Payouts page — see
// src/app/cut/app/(home)/settings/payouts/page.tsx (not wired to this yet).
export default function AdminPaymentMethodsPage() {
  const methods = useAdminPaymentMethods();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Payment Methods</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable payout rails and set their credentials. Secret keys are write-only — once saved,
          this page only shows whether one is set.
        </p>
      </div>

      {methods.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : methods.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load payment methods. Try again.</p>
      ) : (
        <div className="space-y-3">
          {methods.data?.paymentMethods.map((m) => (
            <MethodCard
              key={m.id}
              method={m}
              editing={editingId === m.id}
              onEdit={() => setEditingId(m.id)}
              onDone={() => setEditingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MethodCard({
  method,
  editing,
  onEdit,
  onDone,
}: {
  method: AdminPaymentMethod;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const update = useUpdatePaymentMethod();
  const provider = method.provider as PaymentProvider;
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);

  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [merchantId, setMerchantId] = useState(method.merchantId ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [notes, setNotes] = useState(method.notes ?? "");

  const save = () => {
    update.mutate(
      {
        id: method.id,
        merchantId,
        notes,
        ...(publicKey.trim() ? { publicKey: publicKey.trim() } : {}),
        ...(secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
      },
      {
        onSuccess: () => {
          setPublicKey("");
          setSecretKey("");
          setWebhookSecret("");
          onDone();
        },
      }
    );
  };

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {PAYMENT_PROVIDER_DESCRIPTIONS[provider]}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <CredentialFlag label="Public key" set={method.hasPublicKey} />
            <CredentialFlag label="Secret key" set={method.hasSecretKey} />
            <CredentialFlag label="Webhook secret" set={method.hasWebhookSecret} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={method.enabled}
            onCheckedChange={(v) => update.mutate({ enabled: v, id: method.id })}
            aria-label={`Enable ${label}`}
          />
          {!editing && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="size-3.5" data-icon="inline-start" /> Credentials
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">
                Public key {method.hasPublicKey && <span className="text-muted-foreground">(set)</span>}
              </Label>
              <Input
                type="password"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder={method.hasPublicKey ? "•••••••• (leave blank to keep)" : "Public / client key"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Secret key {method.hasSecretKey && <span className="text-muted-foreground">(set)</span>}
              </Label>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={method.hasSecretKey ? "•••••••• (leave blank to keep)" : "Secret key"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Merchant ID</Label>
              <Input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Webhook secret{" "}
                {method.hasWebhookSecret && <span className="text-muted-foreground">(set)</span>}
              </Label>
              <Input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={method.hasWebhookSecret ? "•••••••• (leave blank to keep)" : "Webhook secret"}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button size="sm" disabled={update.isPending} onClick={save}>
              {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialFlag({ label, set }: { label: string; set: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {set ? (
        <CheckCircle2 className="size-3 text-emerald-500" />
      ) : (
        <Circle className="size-3 text-muted-foreground" />
      )}
      {label}
    </span>
  );
}
