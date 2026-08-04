"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminChatCategories, useCreateChatCategory } from "@/queries/admin";

export default function AdminChatCategoriesPage() {
  const categories = useAdminChatCategories();
  const create = useCreateChatCategory();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { description: description.trim() || undefined, name: name.trim() },
      { onSuccess: () => { setName(""); setDescription(""); } }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Chat Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Groups for chat templates. Prompt counts reflect templates actually assigned to each
          category.
        </p>
      </div>

      {categories.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : categories.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load categories. Try again.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              System Categories ({categories.data?.categories.length ?? 0})
            </p>
            <div className="space-y-2">
              {categories.data?.categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border bg-card p-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{c.name}</p>
                    {c.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                    )}
                  </div>
                  <span className="rounded-lg border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    {c.templateCount} prompts
                  </span>
                </div>
              ))}
              {categories.data?.categories.length === 0 && (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No categories yet.
                </p>
              )}
            </div>
          </div>

          <div className="h-fit space-y-3 rounded-2xl border bg-card p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Create Chat Category
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Category Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Legal Consultant"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Draft agreements and review platform policies"
              />
            </div>
            <Button className="w-full" disabled={!name.trim() || create.isPending} onClick={submit}>
              {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Create Category
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
