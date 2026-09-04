import { brandingUploadRoute } from "../_brandingUpload";

export const dynamic = "force-dynamic";

// PNG only: the /icon route (site/src/app/icon.tsx) reads these bytes back
// with this same content type, and a browser tab icon has no reason to be
// anything larger than a small square PNG. There's no public GET here — the
// /icon convention is the public surface; this route only writes.
export const { PUT, DELETE } = brandingUploadRoute({
  allowedTypes: new Set(["image/png"]),
  field: "favicon",
  maxBytes: 256 * 1024,
  typeErrorMessage: "Favicons must be a PNG image.",
});
