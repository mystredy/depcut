import { siteShareImage, SOCIAL_IMAGE_SIZE } from "./_social-image";

export const dynamic = "force-dynamic";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

// What a shared depcut.com link shows on WhatsApp, Facebook, Discord, and
// the rest — set from admin/settings/general's Default Social Share Image.
// See _social-image.tsx.
export default function Image() {
  return siteShareImage();
}
