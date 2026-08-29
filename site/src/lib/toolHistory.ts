"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Per-tool generation history for the standalone AI Suite pages. The
// backend gateway deliberately never persists prompts or generated content
// (see docs/guides/backend-apis.md's "State stays on the client" rule), so
// this lives entirely in the browser's own IndexedDB — never sent to, or
// readable by, the server.

export type ToolHistoryTool =
  | "scripting"
  | "speech-to-text"
  | "text-to-speech"
  | "dubbing"
  | "text-to-image";

export type ToolHistoryResult =
  | { kind: "text"; text: string; data?: unknown }
  | { kind: "blob"; blob: Blob; mimeType: string; filename: string; data?: unknown };

export type ToolHistoryEntry = {
  id: string;
  tool: ToolHistoryTool;
  createdAt: number;
  // Short label shown in the collapsed row — the topic, prompt, or filename.
  summary: string;
  // Enough of the original form state for "Use again" to refill it.
  inputs: Record<string, unknown>;
  result: ToolHistoryResult;
};

const DB_NAME = "depcut-tool-history";
const STORE = "entries";
// A generous but bounded cap — blobs (audio, images) add up, and nothing
// here is precious enough to keep forever unbounded.
const MAX_PER_TOOL = 20;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("tool", "tool");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error as unknown as Error);
  });
}

async function listHistory(tool: ToolHistoryTool): Promise<ToolHistoryEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).index("tool").getAll(tool);
    req.onsuccess = () => {
      const entries = req.result as ToolHistoryEntry[];
      resolve(entries.sort((a, b) => b.createdAt - a.createdAt));
    };
    req.onerror = () => reject(req.error as unknown as Error);
  });
}

function putEntry(entry: ToolHistoryEntry): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as unknown as Error);
      }),
  );
}

function deleteEntry(id: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as unknown as Error);
      }),
  );
}

async function saveHistoryEntry(
  tool: ToolHistoryTool,
  input: { summary: string; inputs: Record<string, unknown>; result: ToolHistoryResult },
): Promise<void> {
  await putEntry({
    createdAt: Date.now(),
    id: crypto.randomUUID(),
    tool,
    ...input,
  });
  // Evict oldest beyond the cap, now that the new one's in.
  const all = await listHistory(tool);
  await Promise.all(all.slice(MAX_PER_TOOL).map((e) => deleteEntry(e.id)));
}

const queryKey = (tool: ToolHistoryTool) => ["tool-history", tool] as const;

export function useToolHistory(tool: ToolHistoryTool) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryFn: () => listHistory(tool), queryKey: queryKey(tool) });

  const save = useMutation({
    mutationFn: (input: { summary: string; inputs: Record<string, unknown>; result: ToolHistoryResult }) =>
      saveHistoryEntry(tool, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(tool) }),
  });

  const remove = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(tool) }),
  });

  return {
    entries: query.data ?? [],
    remove: remove.mutate,
    save: save.mutate,
  };
}
