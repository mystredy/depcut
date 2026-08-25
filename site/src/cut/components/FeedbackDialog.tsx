"use client";

import { useState } from "react";
import { Loader2, MessageCircleHeart } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateSupportTicket } from "@/queries/support";

/** A subject + message form that files a SupportTicket — bugs, feature asks,
 * anything else a user wants the team to see. Lands in /admin/support and
 * pings the team on Telegram; the sender sees no reply flow here, only
 * confirmation that it went out. */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const createTicket = useCreateSupportTicket();

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  const submit = () => {
    if (!canSubmit || createTicket.isPending) return;
    createTicket.mutate(
      { subject: subject.trim(), message: message.trim() },
      { onSuccess: () => setSent(true) }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle>Thanks for the note</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              We got it and the team's been notified. If it needs a reply, we'll reach you at
              your account email.
            </p>
            <DialogFooter className="mt-2">
              <Button className="w-full" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircleHeart className="size-4.5" /> Give feedback
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Report a bug, ask for something, or just tell us what's on your mind.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="feedback-subject">Subject</Label>
                <Input
                  id="feedback-subject"
                  value={subject}
                  maxLength={160}
                  placeholder="A short summary"
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="feedback-message">Message</Label>
                <Textarea
                  id="feedback-message"
                  className="min-h-28"
                  value={message}
                  maxLength={4000}
                  placeholder="What happened, or what would help"
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
            {createTicket.isError && (
              <p className="text-sm text-red-600">
                {createTicket.error instanceof Error
                  ? createTicket.error.message
                  : "Could not send that. Try again."}
              </p>
            )}
            <DialogFooter className="mt-2">
              <Button
                className="w-full"
                disabled={!canSubmit || createTicket.isPending}
                onClick={submit}
              >
                {createTicket.isPending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {createTicket.isPending ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
