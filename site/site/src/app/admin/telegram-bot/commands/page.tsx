"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plug, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminTelegramCommand,
  useAdminTelegramCommands,
  useConnectTelegramWebhook,
  useCreateTelegramCommand,
  useDeleteTelegramCommand,
  useUpdateTelegramCommand,
} from "@/queries/admin";

export default function AdminTelegramCommandsPage() {
  const commands = useAdminTelegramCommands();
  const update = useUpdateTelegramCommand();
  const del = useDeleteTelegramCommand();
  const [editing, setEditing] = useState<AdminTelegramCommand | "new" | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Commands</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What the bot replies when someone sends it one of these. Use {"{{first_name}}"} or{" "}
            {"{{username}}"} in a reply to include the sender&apos;s name or @handle.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ConnectWebhookButton />
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" data-icon="inline-start" /> Add command
          </Button>
        </div>
      </div>

      {commands.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : commands.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load commands. Try again.</p>
      ) : commands.data?.commands.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No commands yet. Add one to give the bot something to reply to.
        </div>
      ) : (
        <div className="space-y-2">
          {commands.data?.commands.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{c.trigger}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.replyText}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={c.enabled}
                    onCheckedChange={(v) => update.mutate({ enabled: v, id: c.id })}
                    aria-label={`Enable ${c.trigger}`}
                  />
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                    <Pencil className="size-3.5" data-icon="inline-start" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={del.isPending}
                    onClick={() => del.mutate(c.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CommandDialog target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ConnectWebhookButton() {
  const connect = useConnectTelegramWebhook();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={connect.isPending}
        onClick={() => connect.mutate()}
      >
        {connect.isPending ? (
          <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
        ) : (
          <Plug className="size-3.5" data-icon="inline-start" />
        )}
        Connect webhook
      </Button>
      {connect.isSuccess && (
        <span
          title="Telegram will now send messages to this server."
          className="text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-3.5" />
        </span>
      )}
      {connect.isError && (
        <span title={connect.error.message} className="text-destructive">
          <AlertTriangle className="size-3.5" />
        </span>
      )}
    </div>
  );
}

function CommandDialog({
  target,
  onClose,
}: {
  target: AdminTelegramCommand | "new" | null;
  onClose: () => void;
}) {
  const create = useCreateTelegramCommand();
  const update = useUpdateTelegramCommand();
  const isNew = target === "new";
  const openKey = target === null ? "closed" : target === "new" ? "new" : target.id;

  const [key, setKey] = useState(openKey);
  const [trigger, setTrigger] = useState("");
  const [replyText, setReplyText] = useState("");
  if (key !== openKey) {
    setKey(openKey);
    setTrigger(target && target !== "new" ? target.trigger : "");
    setReplyText(target && target !== "new" ? target.replyText : "");
  }

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const save = () => {
    if (isNew) {
      create.mutate({ replyText, trigger }, { onSuccess: onClose });
    } else if (target) {
      update.mutate({ id: target.id, replyText, trigger }, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add command" : "Edit command"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Trigger</Label>
            <Input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="/start"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reply</Label>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder="Hey {{first_name}}, welcome!"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!trigger.trim() || !replyText.trim() || pending} onClick={save}>
            {pending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
