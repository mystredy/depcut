"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudios } from "@/queries/studio";

// Which studio to drop to, when the caller has more than one and none is
// implied by the page it's opened from (the editor's export bar, unlike a
// specific studio's own Post button).
export function ChooseStudioDialog({
  onChoose,
  onClose,
}: {
  onChoose: (studioId: string) => void;
  onClose: () => void;
}) {
  const studios = useStudios();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Drop to which studio?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {(studios.data?.spaces ?? []).map((studio) => (
            <button
              key={studio.id}
              type="button"
              onClick={() => onChoose(studio.id)}
              className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/50"
            >
              {studio.name}
              <span className="text-xs font-normal text-muted-foreground">@{studio.username}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
