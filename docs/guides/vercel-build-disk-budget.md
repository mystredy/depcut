# Vercel Build Disk Budget

The build container that runs `next build` and packages the deploy has its own
disk ceiling, separate from anything about routes or functions. A build can
compile cleanly and still fail afterward, during output packaging, if the
container runs out of space (`ENOSPC`) — Vercel enabled Enhanced Builds for
this project (a larger build machine) after that happened.

**The one rule:** every native dependency that installs more than one
platform's binary is waste — a build on Vercel only ever runs on Linux x64
glibc, so any musl, arm64, or other-OS variant that lands in `node_modules`
never executes there.

## How it works

```text
npm install
      |
      v
os/cpu filtering skips the wrong OS and CPU     <- can't tell glibc from musl
      |
      v
node_modules carries every matching variant     <- unused ones sit dead weight
      |
      v
build container disk: node_modules + build cache + git history + output
      |
      v
ENOSPC if the total exceeds the container's ceiling
```

Most native-binary packages publish no `libc` field, so npm's install-time
platform filtering can rule out the wrong OS or CPU but not the wrong libc —
an install on Vercel's glibc host still pulls down every matching musl
build too, and nothing at runtime ever touches it.

## Constraints

1. **Deleting after install doesn't reclaim space.** Vercel's build layer is
   a squashfs snapshot of the installed tree; removing a file from the live
   directory doesn't free the read-only layer underneath it. The fix has to
   stop the file from being installed at all.
2. **`package.json`'s `overrides` does that**, redirecting an unwanted
   platform package to an empty local stub (see `site/scripts/stubs/`) so npm
   never writes the real binary to disk anywhere, on any platform. Point it
   only at the musl/non-primary variant, never the one the build machine
   actually loads.
3. **`overrides` needs `npm ci` running from the project root to apply.** A
   monorepo-style install invoked with an implicit `--prefix` can silently
   skip a target directory's `overrides` while still installing everything
   else from it correctly — this project's `vercel.json` sets an explicit
   `installCommand: "npm ci"` so that never happens quietly.
4. **Verify with `npm ci`, not `npm install`.** An override that only works
   incrementally against an already-populated `node_modules` can still fail
   the strict, from-scratch install Vercel actually runs.

## Where it lives

Platform-binary overrides and their stub packages live in `site/package.json`
and `site/scripts/stubs/`; the install command lives in `site/vercel.json`;
the build machine size lives in the project's Vercel dashboard, not in this
repo.
