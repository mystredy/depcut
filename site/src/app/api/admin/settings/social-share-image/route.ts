import { brandingUploadRoute } from "../_brandingUpload";

export const dynamic = "force-dynamic";

// PNG or JPEG — what the root opengraph-image route (site/src/app/opengraph-image.tsx)
// reads back and serves as-is. No public GET — that route is the public
// surface, and it also covers Twitter's card image (twitter-image.tsx
// re-exports it).
export const { PUT, DELETE } = brandingUploadRoute({
  allowedTypes: new Set(["image/png", "image/jpeg"]),
  field: "socialShareImage",
  maxBytes: 2 * 1024 * 1024,
  typeErrorMessage: "The social share image must be a PNG or JPEG image.",
});
