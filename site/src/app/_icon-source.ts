import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { appleTouchIconKey, faviconKey, getObject } from "@/cut/server/cloud/r2";

type IconSlot = "favicon" | "appleTouchIcon";

const KEY_FOR: Record<IconSlot, () => string> = {
  appleTouchIcon: appleTouchIconKey,
  favicon: faviconKey,
};

/** The bytes and content type an icon route should serve: the admin-uploaded
 * asset (admin/settings/general) for `slot` if one is set, else the bundled
 * default for that slot. The favicon and apple touch icon are independent
 * uploads — one is never derived from the other — because iOS doesn't read
 * an .ico as a touch icon, and a browser tab icon has no reason to carry the
 * apple touch icon's larger, background-filled shape. */
export async function iconSource(
  slot: IconSlot,
  defaultFile: string
): Promise<{ data: Buffer; contentType: string }> {
  const object = await getObject(KEY_FOR[slot]());
  if (object) {
    return { contentType: object.mime, data: object.bytes };
  }
  const fallback = await readFile(join(process.cwd(), "public", defaultFile));
  return { contentType: defaultFile.endsWith(".ico") ? "image/x-icon" : "image/png", data: fallback };
}
