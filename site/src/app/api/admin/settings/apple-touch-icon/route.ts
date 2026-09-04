import { brandingUploadRoute } from "../_brandingUpload";

export const dynamic = "force-dynamic";

// PNG only, same reasoning as favicon/route.ts. No public GET — the
// /apple-icon convention (site/src/app/apple-icon.tsx) is the public
// surface.
export const { PUT, DELETE } = brandingUploadRoute({
  allowedTypes: new Set(["image/png"]),
  field: "appleTouchIcon",
  maxBytes: 512 * 1024,
  typeErrorMessage: "The apple touch icon must be a PNG image.",
});
