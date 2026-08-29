"use client";

import { useRef, useState } from "react";
import { Loader2, MessageCircleHeart, Paperclip, X } from "lucide-react";
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

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 7;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type Attachment = { dataUrl: string; contentType: string };

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/** A subject + message form that files a SupportTicket — bugs, feature asks,
 * anything else a user wants the team to see. Lands in /admin/support and
 * pings the team on Telegram; the sender sees no reply flow here, only
 * confirmation that it went out. */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createTicket = useCreateSupportTicket();

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  const pickFiles = async (files: FileList | null) => {
    setAttachError(null);
    if (!files || files.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) {
      setAttachError(`Up to ${MAX_ATTACHMENTS} screenshots — the rest weren't added.`);
    }
    const next: Attachment[] = [];
    for (const file of picked) {
      if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        setAttachError("Attach a PNG, JPEG, WebP, or GIF image.");
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError("That image is over the 5 MB limit.");
        continue;
      }
      next.push({ contentType: file.type, dataUrl: await readAsDataURL(file) });
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  };

  const submit = () => {
    if (!canSubmit || createTicket.isPending) return;
    createTicket.mutate(
      {
        subject: subject.trim(),
        message: message.trim(),
        ...(attachments.length > 0
          ? {
              attachments: attachments.map((a) => ({
                // Everything after the comma in a data: URL is the base64
                // payload — the part the server actually wants.
                contentType: a.contentType,
                data: a.dataUrl.slice(a.dataUrl.indexOf(",") + 1),
              })),
            }
          : {}),
      },
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => {
                  void pickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview, not worth a remote loader config for */}
                    <img
                      src={a.dataUrl}
                      alt="Attachment preview"
                      className="h-16 w-16 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {attachments.length < MAX_ATTACHMENTS && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip data-icon="inline-start" />
                    {attachments.length > 0 ? "Add more" : "Attach screenshots"}
                  </Button>
                )}
              </div>
              {attachError && <p className="text-xs text-red-600">{attachError}</p>}
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
