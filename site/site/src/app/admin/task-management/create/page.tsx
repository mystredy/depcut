"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/queries/categories";
import { useAdminUsers, useCreateTask } from "@/queries/admin";

export default function AdminCreateCampaignPage() {
  const router = useRouter();
  const categories = useCategories();
  const users = useAdminUsers("");
  const create = useCreateTask();

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [niche, setNiche] = useState("");
  const [script, setScript] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxRates, setMaxRates] = useState(10);
  const [hoursToComplete, setHoursToComplete] = useState(12);
  const [additionalRevenueReward, setAdditionalRevenueReward] = useState(false);
  const [assignedArtist, setAssignedArtist] = useState("");
  const [fullClip, setFullClip] = useState("");
  const [shortClip, setShortClip] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.data?.categories.find((c) => c.id === categoryId);
  const niches = selectedCategory?.niches.split(",").map((n) => n.trim()).filter(Boolean) ?? [];

  const submit = () => {
    if (!title.trim() || !categoryId) {
      setError("Give the campaign a title and a category.");
      return;
    }
    setError(null);
    create.mutate(
      {
        additionalRevenueReward,
        categoryId,
        fullClip: fullClip.trim() || undefined,
        hoursToComplete,
        instructions: instructions.trim() || undefined,
        maxRates,
        niche: niche || undefined,
        requiredArtists: assignedArtist ? [assignedArtist] : [],
        script: script.trim() || undefined,
        shortClip: shortClip.trim() || undefined,
        title: title.trim(),
      },
      {
        onSuccess: () => router.push("/admin/task-management/campaigns"),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Create Campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publish a new Inspire-mode task. Categories come from the real shared taxonomy.
        </p>
      </div>

      {categories.isLoading ? (
        <Skeleton className="h-96 w-full max-w-2xl" />
      ) : (
        <div className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6">
          <div className="space-y-1.5">
            <Label>Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cinematic Real Estate Walkthrough"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setNiche(""); }}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">Select a category…</option>
                {categories.data?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Niche</Label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                disabled={!categoryId}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring disabled:opacity-50"
              >
                <option value="">No niche selected</option>
                {niches.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Script Notes</Label>
            <Input value={script} onChange={(e) => setScript(e.target.value)} placeholder="e.g. Keep script high energy…" />
          </div>

          <div className="space-y-1.5">
            <Label>Description &amp; Instructions</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="What the submission needs to deliver…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full Clip URL</Label>
              <Input value={fullClip} onChange={(e) => setFullClip(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label>Short Clip / Thumbnail URL</Label>
              <Input value={shortClip} onChange={(e) => setShortClip(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <Label>Max Rates</Label>
              <span className="font-mono text-xs text-muted-foreground">{maxRates} Rates</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={maxRates}
              onChange={(e) => setMaxRates(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <Label>Hours to Complete</Label>
              <span className="font-mono text-xs text-muted-foreground">{hoursToComplete} hrs</span>
            </div>
            <input
              type="range"
              min={1}
              max={48}
              value={hoursToComplete}
              onChange={(e) => setHoursToComplete(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Additional Revenue Reward</p>
              <p className="text-xs text-muted-foreground">
                Turn on supplementary revenue-sharing bonuses for this campaign.
              </p>
            </div>
            <Switch
              checked={additionalRevenueReward}
              onCheckedChange={setAdditionalRevenueReward}
              aria-label="Additional revenue reward"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned Artist</Label>
            <select
              value={assignedArtist}
              onChange={(e) => setAssignedArtist(e.target.value)}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">All Artists (Open Campaign)</option>
              {users.data?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || u.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end pt-2">
            <Button disabled={create.isPending} onClick={submit}>
              {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Launch Live Campaign
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
