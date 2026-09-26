// Read-only access to this site's own GitHub repo, for the AI Skill
// Builder's "read the codebase" tool (/admin/ai/skills/cut). Goes through
// GitHub's Contents API rather than the local filesystem on purpose: a
// hosted Vercel function's disk is a trimmed subset of the repo (Next's
// output file tracing only bundles what a route's own imports statically
// reach — see next.config.ts's own account of a past feature that read
// unscoped cwd-rooted paths and blew past the function size limit instead),
// so a dynamic fs.readFile can't be trusted to find an arbitrary source
// file at runtime. An HTTPS call to GitHub has no such ceiling.

const OWNER = "mystredy";
const REPO = "depcut";

// Only these top-level paths are readable — no .env*, no node_modules, no
// deploy config, whatever GITHUB_REPO_READ_TOKEN can otherwise see.
const ALLOWED_ROOTS = ["site/src", "site/prisma", "docs"];
const ALLOWED_ROOT_FILES = ["site/package.json", "CLAUDE.md", "README.md"];

const MAX_FILE_BYTES = 200_000;
const MAX_LISTING_ENTRIES = 300;

export class RepoReadError extends Error {}

function normalize(relPath: string): string {
  return relPath.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Rejects anything outside the allowlist, including a "../" escape —
 * checked against the normalized string itself, since this never touches a
 * real filesystem for path.resolve to sanity-check against. */
function assertAllowed(relPath: string): void {
  if (relPath.split("/").includes("..")) {
    throw new RepoReadError("Path can't contain \"..\".");
  }
  if (relPath === "") return; // repo root listing
  if (ALLOWED_ROOT_FILES.includes(relPath)) return;
  const allowed = ALLOWED_ROOTS.some((root) => relPath === root || relPath.startsWith(`${root}/`));
  if (!allowed) {
    throw new RepoReadError(
      `"${relPath}" is outside what this tool can read. Allowed: ${[...ALLOWED_ROOTS, ...ALLOWED_ROOT_FILES].join(", ")}.`,
    );
  }
}

function token(): string {
  const t = process.env.GITHUB_REPO_READ_TOKEN;
  if (!t) throw new RepoReadError("GITHUB_REPO_READ_TOKEN isn't configured, so this tool is unavailable.");
  return t;
}

// The Contents API's response shape: a single object for a file, an array
// of these (each with no content/encoding) for a directory listing.
type GithubContentItem = {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  content?: string;
  encoding?: string;
  download_url?: string | null;
};

async function githubGet(path: string): Promise<GithubContentItem | GithubContentItem[]> {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) throw new RepoReadError(`No such path in the repo: "${path}".`);
  if (!res.ok) throw new RepoReadError(`GitHub API error (${res.status}) reading "${path}".`);
  return res.json() as Promise<GithubContentItem | GithubContentItem[]>;
}

export type RepoEntry = { name: string; path: string; kind: "file" | "dir" };

/** Directory listing, repo-relative. Empty path lists the repo root. */
export async function listRepoDir(relPath: string): Promise<RepoEntry[]> {
  const clean = normalize(relPath);
  assertAllowed(clean);
  const body = await githubGet(clean);
  if (!Array.isArray(body)) throw new RepoReadError(`"${clean}" is a file, not a directory.`);
  return body
    .slice(0, MAX_LISTING_ENTRIES)
    .map((e) => ({ kind: e.type === "dir" ? "dir" : "file", name: e.name, path: e.path }) as RepoEntry);
}

/** A file's full text content, repo-relative path. */
export async function readRepoFile(relPath: string): Promise<string> {
  const clean = normalize(relPath);
  assertAllowed(clean);
  const body = await githubGet(clean);
  if (Array.isArray(body) || body.type !== "file") {
    throw new RepoReadError(`"${clean}" is a directory, not a file.`);
  }
  if (typeof body.content === "string" && body.encoding === "base64") {
    const text = Buffer.from(body.content, "base64").toString("utf8");
    return text.length > MAX_FILE_BYTES
      ? `${text.slice(0, MAX_FILE_BYTES)}\n\n… truncated at ${MAX_FILE_BYTES} characters.`
      : text;
  }
  // Content over the Contents API's ~1MB inline limit comes back with a
  // download_url instead of inline content.
  if (typeof body.download_url === "string") {
    const res = await fetch(body.download_url);
    if (!res.ok) throw new RepoReadError(`Could not fetch "${clean}"'s raw content.`);
    const text = await res.text();
    return text.length > MAX_FILE_BYTES
      ? `${text.slice(0, MAX_FILE_BYTES)}\n\n… truncated at ${MAX_FILE_BYTES} characters.`
      : text;
  }
  throw new RepoReadError(`Could not read "${clean}" — unrecognized response from GitHub.`);
}
