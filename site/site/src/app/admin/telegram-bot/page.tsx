"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAdminSocialApps, useAdminSocialConnections } from "@/queries/admin";

// At-a-glance status for the Telegram bot: whether it's configured and
// enabled, and which channels/accounts are actually linked through it.
// Credentials and notification routing live on Settings — this page is for
// seeing status, not entering the bot token.
export default function AdminTelegramOverviewPage() {
  const socialApps = useAdminSocialApps();
  const connections = useAdminSocialConnections();

  const bot = socialApps.data?.socialApps.find((a) => a.platform === "telegram");
  const telegramConnections =
    connections.data?.connections.filter((c) => c.platform === "telegram") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Telegram Bot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status and connected channels for the Telegram bot. Configure the bot token from Settings.
        </p>
      </div>

      {socialApps.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : socialApps.isError || !bot ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the Telegram bot. Try again.</p>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <StatusPill enabled={bot.enabled} configured={bot.configuredFields.length > 0} />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {bot.configuredFields.includes("botToken") ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : (
                <Circle className="size-3.5" />
              )}
              Bot API Token
            </div>
            {bot.values.botUsername && (
              <span className="text-xs text-muted-foreground">
                @{bot.values.botUsername.replace(/^@/, "")}
              </span>
            )}
          </div>
          <Link
            href="/admin/telegram-bot/settings"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <Pencil className="size-3.5" data-icon="inline-start" /> Configure
          </Link>
        </div>
      )}

      <div>
        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Connected channels
        </p>
        {connections.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : connections.isError ? (
          <p className="text-sm text-destructive">Couldn&apos;t load connections. Try again.</p>
        ) : telegramConnections.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No Telegram accounts linked yet. Add one from Social Media → Connections.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {telegramConnections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.accountName}</TableCell>
                    <TableCell className="text-muted-foreground">{c.accountHandle ?? "—"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{c.role}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          c.status === "active"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-border bg-muted text-muted-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            c.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"
                          )}
                        />
                        {c.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" />
      Not configured
    </span>
  );
}
