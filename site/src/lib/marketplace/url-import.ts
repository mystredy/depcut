import ytdl from "@distube/ytdl-core";
import * as cheerio from "cheerio";

// Pulls title/description/tags from a link to a creator's own video, so they
// can reuse it as a starting point for a Drop instead of retyping everything
// by hand. Metadata only for now — none of these fetch the actual video
// bytes; that's separate, still-undecided follow-up work.
export type UrlImportPlatform = "youtube" | "tiktok" | "snapchat";

export type UrlImportResult = {
  platform: UrlImportPlatform;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string | null;
  sourceUrl: string;
};

export class UrlImportError extends Error {}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function detectUrlImportPlatform(url: string): UrlImportPlatform | null {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "youtube";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "snapchat.com" || host.endsWith(".snapchat.com")) return "snapchat";
  return null;
}

// Basic info only (title/description/keywords) — deliberately not getInfo,
// which also resolves downloadable format URLs: that request hung
// indefinitely against YouTube from this environment during testing, while
// getBasicInfo returned cleanly. Revisit if/when actual video download is
// wired up.
async function extractYoutube(url: string): Promise<UrlImportResult> {
  if (!ytdl.validateURL(url)) throw new UrlImportError("That doesn't look like a valid YouTube video link.");
  let info: Awaited<ReturnType<typeof ytdl.getBasicInfo>>;
  try {
    info = await ytdl.getBasicInfo(url);
  } catch (e) {
    throw new UrlImportError(e instanceof Error ? e.message : "Couldn't read that YouTube video.");
  }
  const d = info.videoDetails;
  return {
    description: d.description ?? "",
    platform: "youtube",
    sourceUrl: url,
    tags: d.keywords ?? [],
    thumbnailUrl: d.thumbnails.at(-1)?.url ?? null,
    title: d.title,
  };
}

// TikTok's caption is one field, hashtags typed inline — same shape DepCut's
// own Description field already expects (see DropDialog). oEmbed is
// TikTok's own documented, stable endpoint, so this doesn't depend on
// scraping the page (tried that too; the page returned nothing usable — its
// content renders client-side, so the raw HTML has no metadata to read).
async function extractTiktok(url: string): Promise<UrlImportResult> {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetch(oembedUrl, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new UrlImportError("Couldn't read that TikTok video — check the link is public.");
  const data = (await res.json()) as { title?: string; thumbnail_url?: string };
  const caption = data.title ?? "";
  const tags = [...caption.matchAll(/#(\w+)/g)].map((m) => m[1]);
  return {
    description: caption,
    platform: "tiktok",
    sourceUrl: url,
    tags,
    thumbnailUrl: data.thumbnail_url ?? null,
    title: "",
  };
}

// No oEmbed or public API for Spotlight — falls back to the page's own Open
// Graph tags, the same thing a link preview reads. Untested against a real
// URL (didn't have one on hand); Snapchat's web presence for a Spotlight
// link is thin, so treat this as best-effort and confirm against a real
// link before relying on it.
async function extractSnapchat(url: string): Promise<UrlImportResult> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new UrlImportError("Couldn't read that Snapchat link — check it's a public Spotlight post.");
  const $ = cheerio.load(await res.text());
  const title = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
  const description = $('meta[property="og:description"]').attr("content")?.trim() ?? "";
  const thumbnailUrl = $('meta[property="og:image"]').attr("content") ?? null;
  if (!title && !description) {
    throw new UrlImportError("Couldn't find any video info on that Snapchat link.");
  }
  return { description, platform: "snapchat", sourceUrl: url, tags: [], thumbnailUrl, title };
}

export async function extractFromUrl(url: string): Promise<UrlImportResult> {
  const platform = detectUrlImportPlatform(url);
  if (!platform) throw new UrlImportError("That link isn't a YouTube, TikTok, or Snapchat video.");
  if (platform === "youtube") return extractYoutube(url);
  if (platform === "tiktok") return extractTiktok(url);
  return extractSnapchat(url);
}
