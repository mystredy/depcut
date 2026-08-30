"use client";

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
import { type AdminAiModel, useAdminAiModels, useUpdateAiModel } from "@/queries/admin";

const MODALITY_LABEL: Record<AdminAiModel["modality"], string> = {
  chat: "Chat",
  image: "Image",
  video: "Video",
};

const MODALITY_HINT: Record<AdminAiModel["modality"], string> = {
  chat: "The assistant's own model — no per-request picker exists yet, so this is visibility only.",
  image: "Shown in the model picker on the Image tab and Text to Image.",
  video: "Shown in the model picker on the Video tab and the dashboard composer.",
};

const MODALITY_ORDER: AdminAiModel["modality"][] = ["chat", "image", "video"];

// Which Gemini models are on offer, grouped by what they generate. Disabling
// one here removes it from the matching model picker for every user — the
// video/image composers read /api/ai-models and fall back to the full list
// only if a modality is left with nothing enabled, so this can't brick a
// composer by accident.
export default function AdminAiModelsPage() {
  const models = useAdminAiModels();
  const update = useUpdateAiModel();

  const groups = MODALITY_ORDER.map((modality) => ({
    modality,
    rows: models.data?.models.filter((m) => m.modality === modality) ?? [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI Models</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which chat, image, and video models are active and available to users.
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
              <div>
                <h2 className="text-sm font-semibold">{MODALITY_LABEL[modality]}</h2>
                <p className="text-xs text-muted-foreground">{MODALITY_HINT[modality]}</p>
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
    </div>
  );
}
