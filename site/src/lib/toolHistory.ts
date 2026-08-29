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

// The outcome half of an entry, shared by the stored shape and the save
// input — intersecting a fixed object type with this union distributes
// correctly (unlike Omit/Pick, which don't distribute over a union). A tool
// whose call resolves in the background (see createPendingEntry below)
// starts an entry as "pending" and later resolves it in place; the other
// tools' single-shot save skips straight to succeeded/failed.
type ToolHistoryOutcome =
  | { status: "pending" }
  | { status: "succeeded"; result: ToolHistoryResult }
  | { status: "failed"; errorMessage: string };

export type ToolHistoryResolution = Exclude<ToolHistoryOutcome, { status: "pending" }>;

type ToolHistoryBase = {
  id: string;
  tool: ToolHistoryTool;
  createdAt: number;
  // Short label shown in the row — the topic, prompt, or filename.
  summary: string;
  // Enough of the original form state for "Use again" to refill it.
  inputs: Record<string, unknown>;
};

export type ToolHistoryEntry = ToolHistoryBase & ToolHistoryOutcome;

type SaveHistoryInput = {
  summary: string;
  inputs: Record<string, unknown>;
} & ToolHistoryResolution;

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

function resolveHistoryEntry(id: string, outcome: ToolHistoryResolution): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.get(id);
        req.onsuccess = () => {
          const entry = req.result as ToolHistoryEntry | undefined;
          if (entry) store.put({ ...entry, ...outcome });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as unknown as Error);
      }),
  );
}

function renameEntry(id: string, summary: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.get(id);
        req.onsuccess = () => {
          const entry = req.result as ToolHistoryEntry | undefined;
          if (entry) store.put({ ...entry, summary });
        };
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

// Evict oldest beyond the cap, now that a new one's in.
async function evictOverflow(tool: ToolHistoryTool): Promise<void> {
  const all = await listHistory(tool);
  await Promise.all(all.slice(MAX_PER_TOOL).map((e) => deleteEntry(e.id)));
}

async function saveHistoryEntry(tool: ToolHistoryTool, input: SaveHistoryInput): Promise<void> {
  await putEntry({
    createdAt: Date.now(),
    id: crypto.randomUUID(),
    tool,
    ...input,
  });
  await evictOverflow(tool);
}

// For a call that resolves in the background: create the row immediately
// (as "pending") and hand back its id, so the caller can free the form for
// another submission right away and resolve this entry later, whenever the
// call actually finishes — see resolveHistoryEntry.
async function createPendingEntry(
  tool: ToolHistoryTool,
  input: { summary: string; inputs: Record<string, unknown> },
): Promise<string> {
  const id = crypto.randomUUID();
  await putEntry({ createdAt: Date.now(), id, status: "pending", tool, ...input });
  await evictOverflow(tool);
  return id;
}

const queryKey = (tool: ToolHistoryTool) => ["tool-history", tool] as const;

export function useToolHistory(tool: ToolHistoryTool) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryFn: () => listHistory(tool), queryKey: queryKey(tool) });

  const save = useMutation({
    mutationFn: (input: SaveHistoryInput) => saveHistoryEntry(tool, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(tool) }),
  });

  const remove = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(tool) }),
  });

  const rename = useMutation({
    mutationFn: ({ id, summary }: { id: string; summary: string }) => renameEntry(id, summary),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(tool) }),
  });

  const createPending = useMutation({
    mutationFn: (input: { summary: string; inputs: Record<string, unknown> }) =>
      createPendingEntry(tool, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(tool) }),
  });

  const resolveEntry = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: ToolHistoryResolution }) =>
      resolveHistoryEntry(id, outcome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(tool) }),
  });

  return {
    entries: query.data ?? [],
    remove: remove.mutate,
    rename: rename.mutate,
    save: save.mutate,
    // Await this to get the new row's id, then call resolveEntry once the
    // background call actually finishes.
    createPending: createPending.mutateAsync,
    resolveEntry: resolveEntry.mutate,
  };
}
