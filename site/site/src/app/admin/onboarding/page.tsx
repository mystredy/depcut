"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminOnboardingSlide,
  useAdminOnboardingSlides,
  useUpdateOnboardingSlide,
} from "@/queries/admin";

const SLIDE_LABELS: Record<string, string> = {
  ai_chat: "AI Chat",
  credits: "Credits",
  modes: "Modes",
  plans: "Plans",
  referral: "Referral",
  welcome: "Welcome",
};

export default function AdminOnboardingPage() {
  const slides = useAdminOnboardingSlides();
  const [editing, setEditing] = useState<AdminOnboardingSlide | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Headline and body copy for the six welcome-sequence slides. Layout, bullet lists, and
          live values (Pro price, signup credit amount) stay in code — only wording is editable
          here.
        </p>
      </div>

      {slides.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : slides.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load onboarding slides. Try again.</p>
      ) : (
        <div className="space-y-3">
          {slides.data?.slides.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{SLIDE_LABELS[s.slug] ?? s.slug}</p>
                {s.headline && <p className="mt-0.5 text-sm">{s.headline}</p>}
                <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{s.body}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEditing(s)}>
                <Pencil className="size-3.5" data-icon="inline-start" /> Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      <SlideDialog slide={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SlideDialog({
  slide,
  onClose,
}: {
  slide: AdminOnboardingSlide | null;
  onClose: () => void;
}) {
  const update = useUpdateOnboardingSlide();
  const [headline, setHeadline] = useState(slide?.headline ?? "");
  const [body, setBody] = useState(slide?.body ?? "");

  const key = slide?.id ?? "closed";
  const [openKey, setOpenKey] = useState(key);
  if (key !== openKey) {
    setOpenKey(key);
    setHeadline(slide?.headline ?? "");
    setBody(slide?.body ?? "");
  }

  const save = () => {
    if (!slide || !body.trim()) return;
    update.mutate(
      {
        body,
        headline: slide.headline === null ? null : headline.trim(),
        id: slide.id,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open={slide !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {slide && (SLIDE_LABELS[slide.slug] ?? slide.slug)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {slide?.headline !== null && (
            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Textarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={2} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Body {slide && slide.body.includes("\n\n") && "(blank line separates paragraphs)"}
            </Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!body.trim() || update.isPending} onClick={save}>
            {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
