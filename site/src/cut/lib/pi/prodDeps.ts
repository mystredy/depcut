"use client";

import { geminiModelRoles } from "@/lib/inference/gemini-models";
import { buildAiContext } from "../aiContext";
import { runAiTool } from "../aiTools";
import { normalizeRef } from "../assetRef";
import { NO_CREDITS_MESSAGE, useGenerate } from "../generate";
import { hostedPost } from "../hosted";
import { refsToParts } from "../refMedia";
import type { CutAgentDeps } from "./cutAgent";
import { currentDebris } from "./debris";
import { listCutSkills, readCutSkill } from "./skillsClient";

// The live editor's wiring for the pi chat loop. This module carries the
// browser-only graph (the editor store, hosted auth, media resolution), so
// cutAgent itself stays importable anywhere — the eval runs the same loop in
// Bun with its own deps.

export function productionDeps(): CutAgentDeps {
  return {
    post: (payload, signal) => hostedPost("/api/inference/responses", payload, signal),
    execTool: async (name, args) => {
      if (name === "list_skills") return listCutSkills();
      if (name === "read_skill") return readCutSkill(String(args.name ?? ""));
      return runAiTool(name, args);
    },
    models: {
      simple: geminiModelRoles.chatSimple,
      complex: geminiModelRoles.chat,
      gate: geminiModelRoles.fastDecision,
    },
    buildContext: () => buildAiContext(),
    resolveRefs: async (meta) => {
      const refs = meta.map(normalizeRef).filter((r) => r !== null);
      return (await refsToParts(refs)).parts;
    },
    debris: currentDebris,
    onAuthFail: () => useGenerate.getState().probe(),
    noCreditsMessage: NO_CREDITS_MESSAGE,
    hooks: {
      onGate: (intent, ms, skipped) =>
        console.debug(`[chat] gate ${intent} ${Math.round(ms)}ms${skipped ? " skipped" : ""}`),
      onRound: (ms, firstDeltaMs) =>
        console.debug(
          `[chat] round ${Math.round(ms)}ms${firstDeltaMs === null ? "" : `, first delta ${Math.round(firstDeltaMs)}ms`}`
        ),
    },
  };
}
