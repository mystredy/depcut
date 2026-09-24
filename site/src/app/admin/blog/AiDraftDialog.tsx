"use client";

import { useState } from "react";
import { HelpCircle, Loader2, Sparkles } from "lucide-react";
import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateBlogDraft } from "@/queries/admin";

// Which of the editor's own content the AI agent is working on — decided by
// PostEditor before it opens this dialog, from what's actually selected or
// present at that moment. Not a mode the user picks by hand: a selection in
// Compose always means "this text", existing content with no selection
// means "the post", and an empty post means there's nothing to ask or
// revise yet, only to write.
export type AiDraftTarget =
  | { kind: "new" }
  | { kind: "post"; text: string }
  | { kind: "selection"; text: string; range: { from: number; to: number } };

const COPY: Record<AiDraftTarget["kind"], { title: string; description: string; placeholder: string }> = {
  new: {
    title: "Write with AI",
    description: "Describe the post you want — AI drafts a title and full body for you to review.",
    placeholder: "e.g. 5 tips for editing vertical video for TikTok",
  },
  post: {
    title: "Ask or edit with AI",
    description: "Ask a question about this post, or describe how to revise it.",
    placeholder: "e.g. What is this post about? / Make this more concise",
  },
  selection: {
    title: "Ask or edit with AI",
    description: "Ask a question about the selected text, or describe how to revise it.",
    placeholder: "e.g. What point is this making? / Make this punchier",
  },
};

// Two actions share one prompt field: Ask answers a question against the
// target and applies nothing — Write/Revise drafts replacement content for
// preview-before-apply, same shape the rest of the app uses for AI actions
// (see AiExtendDialog). Applying overwrites just what the target covers —
// the whole post for "new", the body for "post", or exactly the original
// selection range for "selection" (via the Compose editor's own
// insertContentAt, so formatting and undo outside that range are
// untouched) — Discard/Close leaves everything as it was.
export function AiDraftDialog({
  target,
  composeEditor,
  onApplyNew,
  onApplyContent,
  onClose,
}: {
  target: AiDraftTarget;
  composeEditor: Editor | null;
  onApplyNew: (draft: { title: string; contentMarkdown: string }) => void;
  onApplyContent: (contentMarkdown: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const generate = useGenerateBlogDraft();
  const result = generate.data;
  const copy = COPY[target.kind];
  const canAsk = target.kind !== "new";

  const run = (action: "ask" | "write") => {
    if (!prompt.trim()) return;
    generate.mutate({
      action,
      context: target.kind === "new" ? undefined : { text: target.text, type: target.kind },
      prompt: prompt.trim(),
    });
  };

  const askAgain = () => {
    generate.reset();
    setPrompt("");
  };

  const apply = () => {
    if (!result || result.kind !== "draft") return;
    if (target.kind === "new") {
      onApplyNew({ contentMarkdown: result.contentMarkdown, title: result.title ?? "" });
    } else if (target.kind === "selection") {
      composeEditor?.chain().focus().insertContentAt(target.range, result.contentMarkdown).run();
    } else {
      onApplyContent(result.contentMarkdown);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            {target.kind !== "new" && (
              <div className="max-h-32 overflow-y-auto rounded-lg border bg-muted/30 p-2">
                <p className="mb-1 text-xs text-muted-foreground">
                  {target.kind === "selection" ? "Selected text" : "Current post"}
                </p>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{target.text}</p>
              </div>
            )}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={copy.placeholder}
              autoFocus
            />
            {generate.error && (
              <p className="text-xs text-destructive">
                {generate.error instanceof Error ? generate.error.message : "Couldn't reach the AI."}
              </p>
            )}
          </div>
        ) : result.kind === "answer" ? (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Answer</p>
            <p className="whitespace-pre-wrap text-sm">{result.answer}</p>
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Preview — nothing&apos;s applied yet.</p>
            {result.title && <p className="text-sm font-semibold">{result.title}</p>}
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{result.contentMarkdown}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {!result || result.kind === "draft" ? (result ? "Discard" : "Cancel") : "Close"}
          </Button>
          {!result ? (
            <>
              {canAsk && (
                <Button
                  variant="outline"
                  disabled={!prompt.trim() || generate.isPending}
                  onClick={() => run("ask")}
                >
                  {generate.isPending && generate.variables?.action === "ask" ? (
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  ) : (
                    <HelpCircle className="size-4" data-icon="inline-start" />
                  )}
                  Ask
                </Button>
              )}
              <Button disabled={!prompt.trim() || generate.isPending} onClick={() => run("write")}>
                {generate.isPending && generate.variables?.action === "write" ? (
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                ) : (
                  <Sparkles className="size-4" data-icon="inline-start" />
                )}
                {target.kind === "new" ? "Generate" : "Revise"}
              </Button>
            </>
          ) : result.kind === "answer" ? (
            <Button variant="outline" onClick={askAgain}>
              Ask another question
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={generate.isPending} onClick={() => run("write")}>
                Regenerate
              </Button>
              <Button onClick={apply}>Apply</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
