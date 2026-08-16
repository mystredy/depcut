"use client";

import { CheckCircle2, Circle, MessageSquare, Square, Terminal, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAdminSocialApps, useAdminTelegramBotStats, useUpdateSocialApp } from "@/queries/admin";

// The bot's real identity and status — everything here is either fetched
// from Telegram (botId/botUsername via getMe) or counted from what the
// webhook has actually recorded (users, commands). Nothing is simulated;
// a fresh bot genuinely starts at zero.
export default function AdminTelegramMyBotPage() {
  const socialApps = useAdminSocialApps();
  const stats = useAdminTelegramBotStats();
  const update = useUpdateSocialApp();

  const bot = socialApps.data?.socialApps.find((a) => a.platform === "telegram");

  if (socialApps.isLoading) {
    return <Skeleton className="h-80 w-full max-w-2xl" />;
  }
  if (socialApps.isError || !bot) {
    return <p className="text-sm text-destructive">Couldn&apos;t load the Telegram bot. Try again.</p>;
  }

  const username = bot.values.botUsername ?? null;
  const botId = bot.values.botId ?? null;
  const initial = (username ?? "?").replace(/^@/, "").charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">My Bot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status and real usage — configure credentials and commands from Settings and Commands.
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {username ? `@${username.replace(/^@/, "")}` : "Not configured"}
              </p>
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  bot.enabled
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", bot.enabled ? "bg-emerald-500" : "bg-muted-foreground")}
                />
                {bot.enabled ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          {botId && <p className="mt-2 font-mono text-xs text-muted-foreground">{botId}</p>}

          <Button
            className={cn(
              "mt-4 w-full",
              bot.enabled
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-emerald-600 text-white hover:bg-emerald-600/90"
            )}
            disabled={update.isPending || !bot.values.botUsername}
            onClick={() => update.mutate({ enabled: !bot.enabled, id: bot.id })}
          >
            <Square className="size-3.5 fill-current" data-icon="inline-start" />
            {bot.enabled ? "Stop Bot" : "Start Bot"}
          </Button>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquare className="size-4 text-muted-foreground" /> Overview
          </p>

          {stats.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : stats.isError || !stats.data ? (
            <p className="text-sm text-destructive">Couldn&apos;t load stats. Try again.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard icon={Users} label="Users" value={stats.data.users} />
              <StatCard icon={Terminal} label="Commands" value={stats.data.commands} />
              <div className="rounded-xl border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {stats.data.webhookConnectedAt ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                  Webhook
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {stats.data.webhookConnectedAt
                    ? `Connected ${new Date(stats.data.webhookConnectedAt).toLocaleDateString()}`
                    : "Not connected"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
