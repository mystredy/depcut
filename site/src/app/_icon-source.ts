import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

/** The bytes and content type an icon route should serve: the admin-uploaded
 * favicon (admin/settings/general) if one is set, else the bundled default
 * for that slot. Both /icon and /apple-icon share the same uploaded favicon
 * — the upload is PNG-only, which either route can serve — but each keeps
 * its own default file, since only one of the two bundled defaults is a
 * format iOS actually reads. */
export async function iconSource(defaultFile: string): Promise<{ data: Buffer; contentType: string }> {
  const settings = await prisma.appSettings.findUnique({
    select: { favicon: true, faviconContentType: true },
    where: { id: SINGLETON_ID },
  });
  if (settings?.favicon && settings.faviconContentType) {
    return { contentType: settings.faviconContentType, data: Buffer.from(settings.favicon) };
  }
  const data = await readFile(join(process.cwd(), "public", defaultFile));
  const contentType = defaultFile.endsWith(".ico") ? "image/x-icon" : "image/png";
  return { contentType, data };
}
