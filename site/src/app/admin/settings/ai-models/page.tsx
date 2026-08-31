"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, X } from "lucide-react";

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
  API_INTEGRATION_LABELS,
  API_INTEGRATION_MODALITIES,
  type ApiIntegrationProvider,
} from "@/lib/marketplace/api-integrations-seed";
import {
  type AdminAiModel,
  type ProviderCatalogModel,
  useAdminAiModels,
  useAdminApiIntegrations,
  useCreateAiModel,
  useProviderModels,
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
                        <TableCell className="font-medium">
                          <EditableLabel
                            value={m.label}
                            onSave={(label) => update.mutate({ id: m.id, label })}
                          />
                        </TableCell>
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

      <AddModelDialog
        modality={addModality}
        existingModelIds={
          new Set((models.data?.models ?? []).filter((m) => m.modality === addModality).map((m) => m.modelId))
        }
        onOpenChange={(open) => !open && setAddModality(null)}
      />
    </div>
  );
}

/** The Model cell — the label as plain text with a pencil to rename it, or
 * (while editing) a text field with Enter/blur to save and Escape to cancel.
 * A no-op save (unchanged or blank) just closes back to display mode. */
function EditableLabel({ value, onSave }: { value: string; onSave: (label: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="group/rename flex items-center gap-1.5 text-left"
      >
        {value}
        <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/rename:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
        className="h-7 max-w-48 text-sm"
      />
      {/* onMouseDown (not onClick) fires before the input's onBlur, so
          pressing this button commits via the button itself rather than
          racing blur into a cancel. */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          commit();
        }}
        title="Save"
        className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Check className="size-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setEditing(false);
        }}
        title="Cancel"
        className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** A slug tier id guessed from a model id ("gpt-4o-mini" → "gpt-4o-mini",
 * "models/gemini-4-flash" → "gemini-4-flash") — a starting point the admin
 * can still edit, not a requirement. */
function slugifyTier(modelId: string): string {
  return modelId
    .replace(/^models\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Picking a model happens in up to three steps: which active API
// integration to pull from, which of its live models, then confirming the
// tier id (a local app concept the provider can't supply). "Enter manually"
// skips straight to the same three fields the dialog used to be, for a
// provider with nothing wired for discovery (Fal.ai) or when the live call
// fails.
function AddModelDialog({
  modality,
  existingModelIds,
  onOpenChange,
}: {
  modality: AdminAiModel["modality"] | null;
  /** Model ids this modality already has a row for — a provider's catalog
   * hides these rather than offer a pick that just 400s as a duplicate. */
  existingModelIds: Set<string>;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateAiModel();
  const integrations = useAdminApiIntegrations();
  const [provider, setProvider] = useState<ApiIntegrationProvider | null>(null);
  const [manual, setManual] = useState(false);
  const [selected, setSelected] = useState<ProviderCatalogModel | null>(null);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [label, setLabel] = useState("");
  const [modelId, setModelId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const catalog = useProviderModels(provider, modality ?? "chat");

  const reset = () => {
    setProvider(null);
    setManual(false);
    setSelected(null);
    setSearch("");
    setTier("");
    setLabel("");
    setModelId("");
    setError(null);
  };

  const pick = (model: ProviderCatalogModel) => {
    setSelected(model);
    setLabel(model.name);
    setModelId(model.id);
    setTier(slugifyTier(model.id));
  };

  const enterManually = () => {
    setManual(true);
    setProvider(null);
    setSelected(null);
    setLabel("");
    setModelId("");
    setTier("");
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

  const active = (integrations.data?.integrations.filter((i) => i.status === "Active") ?? []).filter(
    (i) => modality !== null && API_INTEGRATION_MODALITIES[i.provider as ApiIntegrationProvider]?.includes(modality)
  );
  const filteredCatalog = (catalog.data?.models ?? []).filter(
    (m) =>
      !existingModelIds.has(m.id) &&
      (!search.trim() ||
        m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        m.id.toLowerCase().includes(search.trim().toLowerCase()))
  );

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

        {manual ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setManual(false);
                setLabel("");
                setModelId("");
                setTier("");
              }}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> Choose from a provider instead
            </button>
            <p className="text-xs text-muted-foreground">
              This adds the row and lets you toggle it — it won&apos;t show up in a user&apos;s model
              picker or be usable until it&apos;s also added to the matching registry in code and
              priced.
            </p>
            <ManualFields
              label={label}
              modelId={modelId}
              tier={tier}
              onLabelChange={setLabel}
              onModelIdChange={setModelId}
              onTierChange={setTier}
            />
          </div>
        ) : provider === null ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pick an active API integration to pull its real, current model list from.
            </p>
            {integrations.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : active.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active API integrations yet — configure one under API Integration first.
              </p>
            ) : (
              <div className="space-y-1.5">
                {active.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setProvider(i.provider as ApiIntegrationProvider)}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted"
                  >
                    {API_INTEGRATION_LABELS[i.provider as ApiIntegrationProvider] ?? i.provider}
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={enterManually}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" /> Enter manually instead
            </button>
          </div>
        ) : selected === null ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setProvider(null)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> {API_INTEGRATION_LABELS[provider]}
            </button>
            {catalog.isLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Fetching {API_INTEGRATION_LABELS[provider]}
                &apos;s models…
              </div>
            ) : catalog.isError ? (
              <div className="space-y-2">
                <p className="text-xs text-destructive">
                  {catalog.error instanceof Error ? catalog.error.message : "Couldn't fetch that provider's models."}
                </p>
                <button
                  type="button"
                  onClick={enterManually}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3" /> Enter manually instead
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter models…"
                />
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {filteredCatalog.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">No matching models.</p>
                  ) : (
                    filteredCatalog.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pick(m)}
                        className="flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <span className="text-[13px] font-medium">{m.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{m.id}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> {API_INTEGRATION_LABELS[provider]} models
            </button>
            <ManualFields
              label={label}
              modelId={modelId}
              tier={tier}
              onLabelChange={setLabel}
              onModelIdChange={setModelId}
              onTierChange={setTier}
            />
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
        {(manual || selected !== null) && (
          <DialogFooter>
            <Button
              disabled={!tier.trim() || !label.trim() || !modelId.trim() || create.isPending}
              onClick={submit}
            >
              {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Add model
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualFields({
  label,
  modelId,
  tier,
  onLabelChange,
  onModelIdChange,
  onTierChange,
}: {
  label: string;
  modelId: string;
  tier: string;
  onLabelChange: (v: string) => void;
  onModelIdChange: (v: string) => void;
  onTierChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ai-model-label">Name</Label>
        <Input
          id="ai-model-label"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g. Gemini 4 Flash"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ai-model-id">Model ID</Label>
        <Input
          id="ai-model-id"
          value={modelId}
          onChange={(e) => onModelIdChange(e.target.value)}
          placeholder="e.g. gemini-4-flash-preview"
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ai-model-tier">Tier ID</Label>
        <Input
          id="ai-model-tier"
          value={tier}
          onChange={(e) => onTierChange(e.target.value.toLowerCase())}
          placeholder="e.g. flash-4"
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Lowercase letters, numbers, and hyphens — must match the tier id a code change gives it
          to actually appear in a picker.
        </p>
      </div>
    </div>
  );
}
