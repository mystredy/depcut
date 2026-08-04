"use client";

import { useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type AdminSupportTicket,
  useAdminSupportTickets,
  useReplySupportTicket,
  useUpdateSupportTicketStatus,
} from "@/queries/admin";

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Every ticket a signed-in user has filed via POST /api/support-tickets.
// There's no creator-facing "contact support" page yet that calls it, so
// this stays empty until one exists — same honest-empty pattern as Payouts.
export default function AdminSupportPage() {
  const tickets = useAdminSupportTickets();
  const open = (tickets.data?.tickets ?? []).filter((t) => t.status !== "Resolved");
  const resolved = (tickets.data?.tickets ?? []).filter((t) => t.status === "Resolved");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <HelpCircle className="size-5 text-muted-foreground" /> Support Requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tickets filed via the support API. No creator-facing contact-support page links to it
          yet, so this list is empty until one does.
        </p>
      </div>

      {tickets.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : tickets.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load tickets. Try again.</p>
      ) : tickets.data?.tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No support tickets yet.
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <div className="space-y-3">
              {open.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          )}
          {resolved.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resolved ({resolved.length})
              </p>
              {resolved.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: AdminSupportTicket }) {
  const reply = useReplySupportTicket();
  const setStatus = useUpdateSupportTicketStatus();
  const [response, setResponse] = useState("");

  const submit = () => {
    if (!response.trim()) return;
    reply.mutate({ id: ticket.id, response: response.trim(), status: "Resolved" });
  };

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs font-bold text-primary">TKT-{1000 + ticket.number}</span>
          <span className="text-xs font-semibold">{ticket.subject}</span>
          <StatusBadge status={ticket.status} />
        </div>
        {ticket.status === "Open" && (
          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: ticket.id, status: "Investigating" })}>
            Mark investigating
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Raised by {ticket.raisedByName} ({ticket.raisedByEmail}) · {timeAgo(ticket.createdAt)}
      </p>

      <p className="rounded-lg border bg-muted/20 p-2.5 text-xs">{ticket.message}</p>

      {ticket.status === "Resolved" ? (
        <p className="rounded-lg border bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
          {ticket.response}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Write response…"
            className="max-w-xs flex-1 rounded-lg border bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring"
          />
          <Button size="sm" variant="outline" disabled={!response.trim() || reply.isPending} onClick={submit}>
            {reply.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Reply & Resolve
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminSupportTicket["status"] }) {
  const styles: Record<AdminSupportTicket["status"], string> = {
    Investigating: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    Open: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Resolved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", styles[status])}>
      {status}
    </span>
  );
}
