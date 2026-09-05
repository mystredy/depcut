// The Claude Agent SDK backs Cut's local-only AI one-shots (server/ai/,
// reached through server/http/next.ts) — but next.config.ts already aliases
// that entry to a 404 stub on Vercel so the engine graph is never traced
// into the hosted build, and the hosted twin of those features (cloud/
// captions.ts) runs on Gemini instead. Nothing in the deployed app reaches
// this package there, yet npm still installs its native CLI binary for
// every Linux variant that matches the build host's arch (glibc and musl
// both, ~240MB and ~235MB — the package publishes no "libc" field, so npm's
// os/cpu filtering can't tell them apart), and that dead weight was enough
// to run a production build out of disk during output packaging. Deleting
// both after install keeps them off Vercel; a no-op elsewhere, so local
// installs are untouched. Runs from postinstall.
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.VERCEL) process.exit(0);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const variants = ["claude-agent-sdk-linux-x64", "claude-agent-sdk-linux-x64-musl"];

for (const variant of variants) {
  const target = path.join(root, "node_modules", "@anthropic-ai", variant);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`prune-unused-native-deps: removed ${variant}`);
  }
}
