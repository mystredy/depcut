import ytdl from "@distube/ytdl-core";
import * as cheerio from "cheerio";

// Pulls title/description/tags from a link to a creator's own post on
// YouTube, TikTok, Snapchat, Facebook, Instagram, or X, so they can reuse it
// as a starting point for a Drop instead of retyping everything by hand.
// resolveDownloadUrl below additionally resolves an actual downloadable
// video URL for the Telegram bot's Download button.
export type UrlImportPlatform = "youtube" | "tiktok" | "snapchat" | "facebook" | "instagram" | "x";

export type UrlImportResult = {
  platform: UrlImportPlatform;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string | null;
  // A direct, playable video URL, when the source's own metadata hands one
  // over — currently only Snapchat's Spotlight posts do (a real og:video).
  // Null everywhere else: YouTube's format-resolving getInfo call hung in
  // this environment (see extractYoutube), TikTok/X's oEmbed has no video
  // field, and Facebook/Instagram weren't reachable enough here to know.
  videoUrl: string | null;
  // The poster's @handle, always with the leading @ when present. YouTube
  // and TikTok hand this over directly; X derives it from oEmbed's
  // author_url; Instagram/Snapchat parse it out of og:title, which embeds
  // it inline; Facebook has no @handle convention at all, so this is null
  // there unless one happens to appear in the title text.
  handle: string | null;
  // The channel/account's own stable platform id, when the source hands one
  // over — currently only YouTube (videoDetails.author.id, the "UC..." id).
  // Used to match a submitted video against a Brand's connected YouTube
  // channel (see /api/submissions/[id]/edit-code) without relying on
  // `handle`, which YouTube's legacy /user/ username often doesn't have.
  channelId: string | null;
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
  if (host === "snapchat.com" || host.endsWith(".snapchat.com")) return "snapchat";
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
//
// YouTube's own bot-check ("Sign in to confirm you're not a bot") is a real,
// common failure for ytdl-style requests from a cloud server IP — ytdl-core
// surfaces it as a plain Error whose message is that exact sentence, which
// reads as an instruction to the person using the bot rather than what it
// actually means (YouTube is blocking this server, not them). Rewritten
// below into something that doesn't require youtubeErrorMessage to guess at
// intent — it's translating one specific, known third-party error string,
// not classifying free-form user text.
function youtubeErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : "";
  if (raw.includes("Sign in to confirm")) {
    return "YouTube is blocking this server's requests right now — try again later.";
  }
  return raw || "Couldn't read that YouTube video.";
}

async function extractYoutube(url: string): Promise<UrlImportResult> {
  if (!ytdl.validateURL(url)) throw new UrlImportError("That doesn't look like a valid YouTube video link.");
  let info: Awaited<ReturnType<typeof ytdl.getBasicInfo>>;
  try {
    info = await ytdl.getBasicInfo(url);
  } catch (e) {
    throw new UrlImportError(youtubeErrorMessage(e));
  }
  const d = info.videoDetails;
  return {
    channelId: d.author?.id ?? null,
    description: d.description ?? "",
    handle: d.author?.user ?? null,
    platform: "youtube",
    sourceUrl: url,
    tags: d.keywords ?? [],
    thumbnailUrl: d.thumbnails.at(-1)?.url ?? null,
    title: d.title,
    videoUrl: null,
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
  const data = (await res.json()) as { title?: string; thumbnail_url?: string; author_unique_id?: string };
  const caption = data.title ?? "";
  const tags = [...caption.matchAll(/#(\w+)/g)].map((m) => m[1]);
  return {
    channelId: null,
    description: caption,
    handle: data.author_unique_id ? `@${data.author_unique_id}` : null,
    platform: "tiktok",
    sourceUrl: url,
    tags,
    thumbnailUrl: data.thumbnail_url ?? null,
    title: "",
    videoUrl: null,
  };
}

// No public, unauthenticated API for a single post on any of these three —
// Meta locked down oEmbed for Facebook/Instagram behind an app access token
// years ago, and Snapchat never had one. Falls back to the page's own Open
// Graph tags instead, the same thing a link preview reads.
//
// Snapchat: verified against a real Spotlight link — full real data,
// including a genuine playable og:video MP4 URL, no auth needed. A
// *different* kind of Snapchat link (an individual Snap shared outside
// Spotlight) instead returns generic profile boilerplate with the same
// shape on every link ("X is on Snapchat!", no og:video) — isBoilerplate
// below exists specifically to catch that and fail honestly instead of
// returning it as if it were the post's real caption.
//
// Facebook/Instagram: a plain Node fetch() with these same headers gets
// real og:title/og:description back for both a public page and a real
// Reel/video post (verified live against both, no login wall) — but the
// identical request, made from inside this app's own dev server instead
// of a bare script, is blocked every time. The two platforms fail
// differently: Facebook returns a 400 outright; Instagram returns 200 but
// with different (likely login-walled) content, so title/description come
// back empty and this throws the same notFoundMessage. Likely Meta's bot
// detection reading something below the header level (TLS/HTTP2
// fingerprint) that a fetch() call can't control either way. Worth
// retesting once this runs on Vercel's infrastructure instead of this
// local dev server — the mechanism itself is sound, this may well be an
// environment-specific block.
const SNAPCHAT_BOILERPLATE = /\bis on Snapchat!?$|^View this Snap from\b/i;

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
  const videoUrl =
    $('meta[property="og:video:secure_url"]').attr("content") ??
    $('meta[property="og:video"]').attr("content") ??
    null;
  if (!title && !description) throw new UrlImportError(notFoundMessage);
  if (platform === "snapchat" && (SNAPCHAT_BOILERPLATE.test(title) || SNAPCHAT_BOILERPLATE.test(description))) {
    throw new UrlImportError(
      "That's a Snap share link, not a Spotlight post — only Spotlight (Snapchat's public video feed) exposes real post info.",
    );
  }
  // Snapchat's title packs engagement stats and hashtags into one line
  // ("49.1K likes... | #viral | ... | Spotlight") rather than putting them
  // in the description — scan both so a title-only hashtag isn't missed.
  const combined = `${title} ${description}`;
  const tags = [...combined.matchAll(/#(\w+)/g)].map((m) => m[1]);
  // Instagram/Snapchat both embed "@handle" directly in og:title
  // ("@viralgroove1 on Instagram: ...", "... (@ihtishaamm) ... Spotlight").
  // Facebook has no @handle convention, so this stays null there unless
  // the title happens to include one.
  const handleMatch = combined.match(/@([\w.]{2,30})/);
  return { channelId: null, description, handle: handleMatch ? `@${handleMatch[1]}` : null, platform, sourceUrl: url, tags, thumbnailUrl, title, videoUrl };
}

// X's own oEmbed, same as TikTok's — documented, free, no auth. Only gives
// the tweet text (as embed HTML, parsed out below) and author, no
// thumbnail/video URL; X doesn't expose either through this endpoint.
async function extractX(url: string): Promise<UrlImportResult> {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
  const res = await fetch(oembedUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new UrlImportError("Couldn't read that X post — check the link is public.");
  const data = (await res.json()) as { html?: string; author_url?: string };
  const text = cheerio.load(data.html ?? "")("p").first().text().trim();
  const tags = [...text.matchAll(/#(\w+)/g)].map((m) => m[1]);
  const handle = data.author_url ? `@${new URL(data.author_url).pathname.replace(/^\//, "")}` : null;
  return {
    channelId: null,
    description: text,
    handle,
    platform: "x",
    sourceUrl: url,
    tags,
    thumbnailUrl: null,
    title: "",
    videoUrl: null,
  };
}

export async function extractFromUrl(url: string): Promise<UrlImportResult> {
  const platform = detectUrlImportPlatform(url);
  if (!platform) {
    throw new UrlImportError("That link isn't a YouTube, TikTok, Snapchat, Facebook, Instagram, or X video.");
  }
  if (platform === "youtube") return extractYoutube(url);
  if (platform === "tiktok") return extractTiktok(url);
  if (platform === "x") return extractX(url);
  if (platform === "snapchat") {
    return extractViaOpenGraph(url, "snapchat", "Couldn't find any video info on that Snapchat link.");
  }
  if (platform === "facebook") {
    return extractViaOpenGraph(url, "facebook", "Couldn't read that Facebook video — check the link is public.");
  }
  return extractViaOpenGraph(url, "instagram", "Couldn't read that Instagram post — check the link is public.");
}

// A direct, downloadable video URL for an already-extracted result, when one
// exists — result.videoUrl if the source handed one over for free (Snapchat
// Spotlight, and Facebook/Instagram when their og:video resolves), otherwise
// YouTube's own format-resolving info call. Null for TikTok/X, which have no
// free source for this at all. getInfo (unlike extractYoutube's
// getBasicInfo) hung indefinitely against YouTube from this environment
// during earlier testing — guarded here with a timeout so a hang fails fast
// instead of blocking the caller forever.
export async function resolveDownloadUrl(
  result: UrlImportResult,
): Promise<{ url: string; sizeBytes: number | null } | null> {
  if (result.videoUrl) return { sizeBytes: null, url: result.videoUrl };
  if (result.platform !== "youtube") return null;

  const info = await Promise.race([
    ytdl.getInfo(result.sourceUrl),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20_000)),
  ]).catch((e) => {
    console.error("resolveDownloadUrl: youtube getInfo failed —", youtubeErrorMessage(e));
    return null;
  });
  if (!info) return null;

  try {
    const format = ytdl.chooseFormat(info.formats, { filter: "videoandaudio", quality: "highest" });
    return { sizeBytes: format.contentLength ? Number(format.contentLength) : null, url: format.url };
  } catch {
    return null;
  }
}
