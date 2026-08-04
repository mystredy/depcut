"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NewProjectButton } from "@/cut/components/NewProjectButton";
import { seedNewProjectDoc } from "@/cut/lib/docCache";
import { projectHref, tabForPath, useCutBase } from "@/cut/lib/nav";
import { patchProjects } from "@/cut/lib/queries";
import { backendFor, type Residency } from "@/cut/lib/residency";
import { track } from "@/lib/analytics";
import type { ProjectSummary } from "@/cut/lib/types";

/** The picker button plus the naming dialog it opens — wherever "New project"
 * lives, this is the whole flow: pick a shelf, name it, land in the editor. */
export function NewProjectLauncher({
  className,
  source,
}: {
  className?: string;
  source: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = useCutBase();
  const client = useQueryClient();
  // The residency the pending creation was launched for; null when the naming
  // dialog is closed.
  const [createIn, setCreateIn] = useState<Residency | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (r: Residency) => {
    setBusy(true);
    try {
      const res = await backendFor(r).fetch("/api/cut/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled" }),
      });
      const project = (await res.json()) as ProjectSummary;
      patchProjects(client, r, (s) => ({
        ...s,
        projects: [project, ...s.projects],
      }));
      // A brand-new project's document is empty, so the editor about to open
      // needs no round trip to draw it.
      seedNewProjectDoc(project.id, project.name, r);
      track("project_created", { source });
      // The link carries no residency; the editor resolves it by asking which
      // backend owns the id, so a cloud project created from a Mac still opens
      // against the cloud.
      router.push(projectHref(base, project.id, tabForPath(pathname), null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <NewProjectButton
        picker
        className={className}
        onCreate={(r) => {
          setName("");
          setCreateIn(r);
        }}
      />
      <Dialog open={createIn !== null} onOpenChange={(o) => !o && setCreateIn(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (createIn) void create(createIn);
            }}
          >
            <Input
              autoFocus
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
