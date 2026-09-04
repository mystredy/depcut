import { siteShareImage, SOCIAL_IMAGE_SIZE } from "./_social-image";

export const dynamic = "force-dynamic";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

// X's card image — the same asset opengraph-image.tsx serves. See
// _social-image.tsx for why this isn't just that file re-exported: Next
// resolves the two conventions independently, with no fallback between them.
export default function Image() {
  return siteShareImage();
}
