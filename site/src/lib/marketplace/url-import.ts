import ytdl from "@distube/ytdl-core";
import * as cheerio from "cheerio";

// Pulls title/description/tags from a link to a creator's own post on
// YouTube, TikTok, Facebook, Instagram, or X, so they can reuse it as a
// starting point for a Drop instead of retyping everything by hand.
// Metadata only for now — none of these fetch the actual video bytes;
// that's separate, still-undecided follow-up work.
//
// Snapchat was tried and dropped: its Spotlight/Snap share pages only ever
// expose generic profile boilerplate through Open Graph tags ("X is on
// Snapchat!", the same on every link, no og:video at all) — confirmed
// against a real share link, not just untested. Nothing to extract, so
// there's no honest way to support it without a real API.
export type UrlImportPlatform = "youtube" | "tiktok" | "facebook" | "instagram" | "x";

export type UrlImportResult = {
  platform: UrlImportPlatform;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string | null;
  sourceUrl: string;
};

export class UrlImportError extends Error {}

const BROWSER_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export function detectUrlImportPlatform(url: string): UrlImportPlatform | null {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "youtube";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch") return "facebook";
  if (host === "instagram.com" || host === "m.instagram.com") return "instagram";
  if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") return "x";
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
  const res = await fetch(oembedUrl, { headers: BROWSER_HEADERS });
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

// No public, unauthenticated API for a single post on either of these —
// Meta locked down oEmbed for Facebook/Instagram behind an app access token
// years ago. Falls back to the page's own Open Graph tags instead, the
// same thing a link preview reads.
//
// A plain Node fetch() with these same headers gets real
// og:title/og:description back for a public page (verified live, no login
// wall) — but that exact request, made from inside this app's own dev
// server instead of a bare script, consistently gets a 400 from Facebook
// with nothing else different. Likely Meta's bot detection reading
// something below the header level (TLS/HTTP2 fingerprint) that a fetch()
// call can't control either way. Worth retesting once this runs on Vercel's
// infrastructure instead of this local dev server — the mechanism itself is
// sound, this may well be an environment-specific block.
async function extractViaOpenGraph(
  url: string,
  platform: UrlImportPlatform,
  notFoundMessage: string,
): Promise<UrlImportResult> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new UrlImportError(notFoundMessage);
  const $ = cheerio.load(await res.text());
  const title = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
  const description = $('meta[property="og:description"]').attr("content")?.trim() ?? "";
  const thumbnailUrl = $('meta[property="og:image"]').attr("content") ?? null;
  if (!title && !description) throw new UrlImportError(notFoundMessage);
  const tags = [...description.matchAll(/#(\w+)/g)].map((m) => m[1]);
  return { description, platform, sourceUrl: url, tags, thumbnailUrl, title };
}

// X's own oEmbed, same as TikTok's — documented, free, no auth. Only gives
// the tweet text (as embed HTML, parsed out below) and author, no
// thumbnail/video URL; X doesn't expose either through this endpoint.
async function extractX(url: string): Promise<UrlImportResult> {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
  const res = await fetch(oembedUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new UrlImportError("Couldn't read that X post — check the link is public.");
  const data = (await res.json()) as { html?: string };
  const text = cheerio.load(data.html ?? "")("p").first().text().trim();
  const tags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1]);
  return { description: text, platform: "x", sourceUrl: url, tags, thumbnailUrl: null, title: "" };
}

export async function extractFromUrl(url: string): Promise<UrlImportResult> {
  const platform = detectUrlImportPlatform(url);
  if (!platform) {
    throw new UrlImportError("That link isn't a YouTube, TikTok, Facebook, Instagram, or X video.");
  }
  if (platform === "youtube") return extractYoutube(url);
  if (platform === "tiktok") return extractTiktok(url);
  if (platform === "x") return extractX(url);
  if (platform === "facebook") {
    return extractViaOpenGraph(url, "facebook", "Couldn't read that Facebook video — check the link is public.");
  }
  return extractViaOpenGraph(url, "instagram", "Couldn't read that Instagram post — check the link is public.");
}
