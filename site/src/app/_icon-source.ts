import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

type IconSlot = "favicon" | "appleTouchIcon";

const COLUMNS: Record<IconSlot, { data: "favicon" | "appleTouchIcon"; type: "faviconContentType" | "appleTouchIconContentType" }> = {
  appleTouchIcon: { data: "appleTouchIcon", type: "appleTouchIconContentType" },
  favicon: { data: "favicon", type: "faviconContentType" },
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
  const columns = COLUMNS[slot];
  const settings = await prisma.appSettings.findUnique({
    select: { [columns.data]: true, [columns.type]: true },
    where: { id: SINGLETON_ID },
  });
  const data = settings?.[columns.data];
  const contentType = settings?.[columns.type];
  if (data && contentType) {
    return { contentType, data: Buffer.from(data) };
  }
  const fallback = await readFile(join(process.cwd(), "public", defaultFile));
  return { contentType: defaultFile.endsWith(".ico") ? "image/x-icon" : "image/png", data: fallback };
}
