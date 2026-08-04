"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, type Category } from "@/queries/categories";
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/queries/admin";

function splitNiches(niches: string): string[] {
  return niches
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

// The single taxonomy Submit Project and Inspiration both read from — see
// /api/categories. Names aren't editable here: they're the join key used by
// Submission.niche and Task.category, so renaming one here would silently
// orphan existing rows. Niches are a comma-separated string on the row; this
// page edits them as individual chips and rejoins on save.
export default function AdminCategoriesPage() {
  const categories = useCategories();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Categories & Niches</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The shared category taxonomy for Submit Project and Inspiration.
        </p>
      </div>

      <AddCategoryForm />

      {categories.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : categories.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load categories. Try again.</p>
      ) : (
        <div className="space-y-3">
          {categories.data?.categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddCategoryForm() {
  const create = useCreateCategory();
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!emoji.trim() || !name.trim()) return;
    setError(null);
    create.mutate(
      { emoji: emoji.trim(), name: name.trim() },
      {
        onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't add that category."),
        onSuccess: () => {
          setEmoji("");
          setName("");
        },
      }
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-sm font-semibold">Add New Category</p>
      <div className="flex gap-2">
        <Input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🎬"
          className="w-16 text-center"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Podcasts, Animation, Reviews"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button disabled={!emoji.trim() || !name.trim() || create.isPending} onClick={submit}>
          {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const update = useUpdateCategory();
  const del = useDeleteCategory();
  const [newNiche, setNewNiche] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingNiche, setEditingNiche] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const niches = splitNiches(category.niches);

  const saveNiches = (next: string[]) => {
    update.mutate({ categoryId: category.id, niches: next.join(", ") });
  };

  const removeNiche = (niche: string) => saveNiches(niches.filter((n) => n !== niche));

  const startRename = (niche: string) => {
    setEditingNiche(niche);
    setEditingValue(niche);
  };

  const commitRename = () => {
    const value = editingValue.trim();
    if (editingNiche === null) return;
    if (value && value !== editingNiche && !niches.includes(value)) {
      saveNiches(niches.map((n) => (n === editingNiche ? value : n)));
    }
    setEditingNiche(null);
  };

  const addNiche = () => {
    const value = newNiche.trim();
    if (!value || niches.includes(value)) return;
    saveNiches([...niches, value]);
    setNewNiche("");
  };

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{category.emoji}</span>
          <p className="text-sm font-semibold">{category.name}</p>
        </div>
        <button
          type="button"
          disabled={del.isPending}
          onClick={() => {
            setDeleteError(null);
            del.mutate(category.id, {
              onError: (err: unknown) =>
                setDeleteError(err instanceof Error ? err.message : "Couldn't delete that category."),
            });
          }}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Delete category"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {niches.length === 0 && <p className="text-xs text-muted-foreground">No niches yet.</p>}
        {niches.map((niche) =>
          editingNiche === niche ? (
            <input
              key={niche}
              autoFocus
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditingNiche(null);
              }}
              onBlur={commitRename}
              className="h-[26px] w-32 rounded-full border bg-background px-2.5 text-xs outline-none focus-visible:border-ring"
            />
          ) : (
            <span
              key={niche}
              className="flex items-center gap-1 rounded-full border bg-muted/40 py-1 pr-1.5 pl-2.5 text-xs"
            >
              {niche}
              <button
                type="button"
                onClick={() => startRename(niche)}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                title={`Rename ${niche}`}
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => removeNiche(niche)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title={`Remove ${niche}`}
              >
                <X className="size-3" />
              </button>
            </span>
          )
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={newNiche}
          onChange={(e) => setNewNiche(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNiche()}
          placeholder="Add a niche…"
          className="h-8"
        />
        <Button size="sm" variant="outline" disabled={!newNiche.trim() || update.isPending} onClick={addNiche}>
          Add
        </Button>
      </div>
      {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
    </div>
  );
}
