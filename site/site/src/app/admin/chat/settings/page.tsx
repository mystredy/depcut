"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAdminChatSettings, useUpdateChatSettings } from "@/queries/admin";

const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-computer-use"];

export default function AdminChatSettingsPage() {
  const settings = useAdminChatSettings();
  const update = useUpdateChatSettings();

  const [defaultModel, setDefaultModel] = useState(MODELS[0]);
  const [temperature, setTemperature] = useState(70);
  const [maxOutputTokens, setMaxOutputTokens] = useState(4096);
  const [streamOutput, setStreamOutput] = useState(true);

  useEffect(() => {
    if (!settings.data) return;
    setDefaultModel(settings.data.settings.defaultModel);
    setTemperature(settings.data.settings.temperature);
    setMaxOutputTokens(settings.data.settings.maxOutputTokens);
    setStreamOutput(settings.data.settings.streamOutput);
  }, [settings.data]);

  const save = () => {
    update.mutate({ defaultModel, maxOutputTokens, streamOutput, temperature });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Chat Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Default model and sampling parameters for the chat assistant. Not read by the real
          inference path yet — the assistant currently calls a fixed model directly — this is
          stored for when that wiring is built.
        </p>
      </div>

      {settings.isLoading ? (
        <Skeleton className="h-80 w-full max-w-xl" />
      ) : settings.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>
      ) : (
        <div className="max-w-xl space-y-5 rounded-2xl border bg-card p-6">
          <div className="space-y-1.5">
            <Label>Default Model</Label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <Label>Temperature</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {(temperature / 100).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Max Output Tokens</Label>
            <Input
              type="number"
              value={maxOutputTokens}
              onChange={(e) => setMaxOutputTokens(Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Stream Output Tokens</p>
              <p className="text-xs text-muted-foreground">
                Yield tokens incrementally for a more responsive feel.
              </p>
            </div>
            <Switch checked={streamOutput} onCheckedChange={setStreamOutput} aria-label="Stream output" />
          </div>

          <div className="flex justify-end pt-2">
            <Button disabled={update.isPending} onClick={save}>
              {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Apply Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
