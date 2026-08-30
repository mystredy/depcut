"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdminAiModel,
  useAdminAiModels,
  useCreateAiModel,
  useUpdateAiModel,
} from "@/queries/admin";

const MODALITY_LABEL: Record<AdminAiModel["modality"], string> = {
  chat: "Chat",
  image: "Image",
  video: "Video",
  audio: "Audio",
};

const MODALITY_HINT: Record<AdminAiModel["modality"], string> = {
  chat: "The assistant's own model — no per-request picker exists yet, so this is visibility only.",
  image: "Shown in the model picker on the Image tab and Text to Image.",
  video: "Shown in the model picker on the Video tab and the dashboard composer.",
  audio: "Voice and music generation — no per-request picker exists yet, so this is visibility only.",
};

const MODALITY_ORDER: AdminAiModel["modality"][] = ["chat", "image", "video", "audio"];

// Which Gemini models are on offer, grouped by what they generate. Disabling
// one here removes it from the matching model picker for every user — the
// video/image composers read /api/ai-models and fall back to the full list
// only if a modality is left with nothing enabled, so this can't brick a
// composer by accident.
//
// "Add model" registers a row here for a model the codebase doesn't already
// list — but that alone doesn't make it selectable: a picker only ever shows
// tiers baked into videoModels.ts/imageModels.ts, and a generate request is
// rejected unless its model id is priced in provider-pricing.ts. Adding it
// here is the admin-visible half of shipping a new model; wiring it into a
// real picker and pricing it is still a code change — see AddModelDialog.
export default function AdminAiModelsPage() {
  const models = useAdminAiModels();
  const update = useUpdateAiModel();
  const [addModality, setAddModality] = useState<AdminAiModel["modality"] | null>(null);

  const groups = MODALITY_ORDER.map((modality) => ({
    modality,
    rows: models.data?.models.filter((m) => m.modality === modality) ?? [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI Models</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which chat, image, video, and audio models are active and available to users.
        </p>
      </div>

      {models.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : models.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load AI models. Try again.</p>
      ) : (
        <div className="space-y-6">
          {groups.map(({ modality, rows }) => (
            <div key={modality} className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{MODALITY_LABEL[modality]}</h2>
                  <p className="text-xs text-muted-foreground">{MODALITY_HINT[modality]}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAddModality(modality)}>
                  <Plus className="size-3.5" data-icon="inline-start" /> Add model
                </Button>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-muted-foreground">Model ID</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {m.modelId}
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={m.enabled}
                            onCheckedChange={(v) => update.mutate({ enabled: v, id: m.id })}
                            aria-label={`Enable ${m.label}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddModelDialog modality={addModality} onOpenChange={(open) => !open && setAddModality(null)} />
    </div>
  );
}

function AddModelDialog({
  modality,
  onOpenChange,
}: {
  modality: AdminAiModel["modality"] | null;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateAiModel();
  const [tier, setTier] = useState("");
  const [label, setLabel] = useState("");
  const [modelId, setModelId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTier("");
    setLabel("");
    setModelId("");
    setError(null);
  };

  const submit = () => {
    if (!modality || !tier.trim() || !label.trim() || !modelId.trim()) return;
    setError(null);
    create.mutate(
      { label: label.trim(), modality, modelId: modelId.trim(), tier: tier.trim() },
      {
        onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't add that model."),
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog
      open={modality !== null}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add {modality ? MODALITY_LABEL[modality] : ""} model</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          This adds the row and lets you toggle it — it won&apos;t show up in a user&apos;s model
          picker or be usable until it&apos;s also added to the matching registry in code and priced.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-label">Name</Label>
            <Input
              id="ai-model-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Gemini 4 Flash"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-id">Model ID</Label>
            <Input
              id="ai-model-id"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. gemini-4-flash-preview"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-tier">Tier ID</Label>
            <Input
              id="ai-model-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value.toLowerCase())}
              placeholder="e.g. flash-4"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Lowercase letters, numbers, and hyphens — must match the tier id a code change gives
              it to actually appear in a picker.
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={!tier.trim() || !label.trim() || !modelId.trim() || create.isPending}
            onClick={submit}
          >
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Add model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
