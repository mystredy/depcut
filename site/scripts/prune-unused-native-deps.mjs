// Vercel's build machine is glibc (Amazon Linux); the musl build of the
// Claude Agent SDK's native binary never runs there, but the package
// publishes no "libc" field, so npm's os/cpu filtering can't tell glibc
// and musl apart — both ~235MB platform binaries land in node_modules on
// every install, and every route that imports the SDK (cut-cloud,
// cut-shared) traces the unused one into its function bundle too. Deleting
// it after install keeps that dead weight out of the deploy. Runs from
// postinstall; a no-op off Vercel, so local installs (musl-based ones
// included) are untouched.
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.VERCEL) process.exit(0);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(
  root,
  "node_modules",
  "@anthropic-ai",
  "claude-agent-sdk-linux-x64-musl",
);

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
  console.log("prune-unused-native-deps: removed claude-agent-sdk-linux-x64-musl");
}
