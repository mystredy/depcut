import os from "node:os";
import path from "node:path";

/**
 * Where Cut keeps its projects/ and library/ folders. The dev server keeps
 * them next to the checkout (cwd, gitignored). The engine binary runs as a
 * LaunchAgent whose cwd is "/", so it sets DEPCUT_CUT_ENGINE and data lives in
 * the user's Application Support instead. DEPCUT_CUT_DATA_DIR overrides both.
 */
export function cutDataRoot(): string {
  if (process.env.DEPCUT_CUT_DATA_DIR) return process.env.DEPCUT_CUT_DATA_DIR;
  if (process.env.DEPCUT_CUT_ENGINE) {
    return path.join(os.homedir(), "Library", "Application Support", "DepCut");
  }
  return process.cwd();
}
