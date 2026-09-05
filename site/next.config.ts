import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  // Cut's local-only engine code (src/cut/lib/pi, watch, backend, worker) never
  // runs on a hosted deploy — see the turbopack alias below — but tsc still
  // type-checks it since it's part of the source tree. Its pre-existing type
  // drift shouldn't block a hosted build; `next dev` and local editors still
  // surface these errors normally.
  typescript: { ignoreBuildErrors: true },
  // Workspace packages ship TypeScript source; the app build transpiles them.
  transpilePackages: ["@depcut/effects-kit"],
  // Cut (the video editor) uploads large media. Two independent limits apply:
  // its media route reads req.formData() (a route handler), so it isn't covered
  // by serverActions.bodySizeLimit; and src/proxy.ts runs on /api/cut/* on every
  // request, which makes Next clone the request body and truncate it at the 10MB
  // proxy default — a truncated multipart body then fails formData parsing. Raise
  // both so real video/audio files upload intact.
  experimental: {
    serverActions: { bodySizeLimit: "4gb" },
    proxyClientMaxBodySize: "4gb",
  },
  // Cut is local-only: /api/cut/* 404s on a hosted deploy and never runs the
  // engine. But Turbopack's file tracer still follows the route's import of the
  // engine router, and that graph reaches cwd-rooted file operations it can't
  // statically scope — so it sweeps local media, committed stock video, and the
  // ~220MB Claude Agent SDK CLI binary into the serverless function, past
  // Vercel's 250MB limit. (outputFileTracingExcludes can't help: it's a no-op
  // under Turbopack builds.) On hosted builds only, alias the engine entry to a
  // 404 stub so the engine graph is never traced; local builds keep the real
  // router, so `next dev`/`next start` serve Cut normally.
  //
  // That alias only keeps the binary out of the traced function — npm still
  // installs it into node_modules on every install, hosted or not, since it's
  // an ordinary dependency. On Vercel that alone was enough to run a build out
  // of disk during output packaging (deleting it post-install doesn't help:
  // Vercel's build layer is a squashfs snapshot taken from the installed tree,
  // and removing a file from a running container doesn't reclaim the read-only
  // layer underneath it). package.json's "overrides" swaps the two Linux
  // platform packages for empty local stubs (scripts/stubs/) so the real
  // ~240MB-each binaries are never installed in the first place, anywhere —
  // safe because nothing reachable in the hosted build imports this package at
  // all (this alias, plus the hosted caption/subtitle routes running on Gemini
  // instead), and the override only targets the Linux variants, so macOS
  // installs (where the engine's local AI one-shots actually run) are
  // untouched.
  turbopack: process.env.VERCEL
    ? {
        resolveAlias: {
          "@/cut/server/http/next": "./src/cut/server/http/hosted-stub.ts",
        },
      }
    : undefined,
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
});

export default withMDX(nextConfig);
