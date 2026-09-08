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
  useUpdateSupportTicketPriority,
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

// Every ticket a signed-in user has filed via the account menu's "Give
// feedback" dialog (POST /api/support-tickets), threaded: each ticket holds
// the raiser's opening message plus every admin reply, not just one final
// response.
export default function AdminSupportPage() {
  const tickets = useAdminSupportTickets();
  const closed = (tickets.data?.tickets ?? []).filter((t) => t.status === "Closed");
  const active = (tickets.data?.tickets ?? []).filter((t) => t.status !== "Closed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <HelpCircle className="size-5 text-muted-foreground" /> Support Requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Feedback and bug reports filed from the account menu.
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
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          )}
          {closed.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Closed ({closed.length})
              </p>
              {closed.map((t) => (
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
  const setPriority = useUpdateSupportTicketPriority();
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    reply.mutate({ id: ticket.id, message: draft.trim() }, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs font-bold text-primary">TKT-{1000 + ticket.number}</span>
          <span className="text-xs font-semibold">{ticket.subject}</span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={ticket.priority}
            onChange={(e) =>
              setPriority.mutate({
                id: ticket.id,
                priority: e.target.value as AdminSupportTicket["priority"],
              })
            }
            className="rounded-lg border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          {ticket.status === "Open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus.mutate({ id: ticket.id, status: "Investigating" })}
            >
              Mark investigating
            </Button>
          )}
          {ticket.status !== "Closed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus.mutate({ id: ticket.id, status: "Closed" })}
            >
              Close
            </Button>
          )}
          {ticket.status === "Closed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus.mutate({ id: ticket.id, status: "Open" })}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Raised by {ticket.raisedByName} ({ticket.raisedByEmail}) · {timeAgo(ticket.createdAt)}
      </p>

      <div className="space-y-2">
        {ticket.messages.map((m) => {
          const fromRaiser = m.authorId === ticket.messages[0]?.authorId;
          return (
            <div
              key={m.id}
              className={cn(
                "space-y-1.5 rounded-lg border p-2.5 text-xs",
                fromRaiser ? "bg-muted/20" : "bg-emerald-500/10"
              )}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-medium">{fromRaiser ? m.authorName : `${m.authorName} (admin)`}</span>
                <span>{timeAgo(m.createdAt)}</span>
              </div>
              <p>{m.message}</p>
              {m.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {m.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/admin/support-tickets/attachment/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-fit"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- an admin-only inline-DB image, not worth a remote loader config for */}
                      <img
                        src={`/api/admin/support-tickets/attachment/${a.id}`}
                        alt="Attachment"
                        className="h-24 w-auto rounded-lg border object-cover transition-opacity hover:opacity-90"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) submit();
          }}
          placeholder="Write a reply…"
          className="max-w-xs flex-1 rounded-lg border bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring"
        />
        <Button size="sm" variant="outline" disabled={!draft.trim() || reply.isPending} onClick={submit}>
          {reply.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
          Reply
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminSupportTicket["status"] }) {
  const styles: Record<AdminSupportTicket["status"], string> = {
    Answered: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    Closed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    Investigating: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    Open: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", styles[status])}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: AdminSupportTicket["priority"] }) {
  const styles: Record<AdminSupportTicket["priority"], string> = {
    High: "bg-red-500/10 text-red-700 dark:text-red-400",
    Low: "bg-muted text-muted-foreground",
    Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", styles[priority])}>
      {priority}
    </span>
  );
}
