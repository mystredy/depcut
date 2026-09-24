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
  // The source video's own stable id — currently only YouTube. Different URL
  // shapes (youtu.be/X, youtube.com/watch?v=X, .../shorts/X) all point at
  // the same upload; this is what lets a caller dedupe by video rather than
  // by exact URL text (see /api/submissions/[id]/edit-code's duplicate
  // check).
  videoId: string | null;
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
  if (raw === "timeout") {
    return "YouTube took too long to respond — try again in a moment.";
  }
  return raw || "Couldn't read that YouTube video.";
}

const RAPIDAPI_HOST = "youtube-v2.p.rapidapi.com";

type RapidApiVideoDetails = {
  title?: string;
  author?: string;
  description?: string;
  channel_id?: string;
  keywords?: string[];
  thumbnails?: { url: string }[];
};

// Fallback source for YouTube metadata, for when ytdl-core's getBasicInfo
// (extractYoutubeViaYtdlCore below, tried first) fails — a plain HTTPS call
// to a hosted API instead of youtube.com itself, so it isn't subject to the
// same bot-check/hang behavior. Throws on any problem (not configured,
// non-2xx, an empty/error body) so the caller knows to give up rather than
// silently returning nothing.
async function extractYoutubeViaRapidApi(url: string, videoId: string): Promise<UrlImportResult> {
  const apiKey = process.env.RAPIDAPI_KEY?.trim();
  if (!apiKey) throw new UrlImportError("RapidAPI is not configured.");

  const res = await Promise.race([
    fetch(`https://${RAPIDAPI_HOST}/video/details?video_id=${encodeURIComponent(videoId)}`, {
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": apiKey,
      },
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
  ]);
  if (!res.ok) throw new UrlImportError(`RapidAPI returned ${res.status}.`);

  const data = (await res.json()) as RapidApiVideoDetails;
  if (!data.title) throw new UrlImportError("RapidAPI returned no video details.");

  return {
    channelId: data.channel_id ?? null,
    description: data.description ?? "",
    handle: data.author ?? null,
    platform: "youtube",
    sourceUrl: url,
    tags: data.keywords ?? [],
    thumbnailUrl: data.thumbnails?.at(-1)?.url ?? null,
    title: data.title,
    videoId,
    videoUrl: null,
  };
}

// Primary source for YouTube metadata — basic info only (title/description/
// keywords), deliberately not getInfo, which also resolves downloadable
// format URLs: that request hung indefinitely against YouTube from this
// environment during testing, while getBasicInfo returned cleanly. Revisit
// if/when actual video download is wired up. On failure, the caller falls
// back to extractYoutubeViaRapidApi below.
async function extractYoutubeViaYtdlCore(url: string, videoId: string): Promise<UrlImportResult> {
  let info: Awaited<ReturnType<typeof ytdl.getBasicInfo>>;
  try {
    // getBasicInfo has hung indefinitely against YouTube from this
    // environment for some videos, same as getInfo below — guarded with the
    // same 20s race so a hang fails fast with a real error instead of
    // leaving the caller (Check, the Telegram Download button) waiting
    // forever.
    info = await Promise.race([
      ytdl.getBasicInfo(url),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20_000)),
    ]);
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
    videoId,
    videoUrl: null,
  };
}

// The video id straight from the URL's own shape — no network call, unlike
// extractFromUrl below. Lets a caller do something cheap with the id (like
// a duplicate check) before spending an API call on metadata that a dupe
// would just throw away.
export function extractYoutubeVideoId(url: string): string | null {
  return ytdl.validateURL(url) ? ytdl.getVideoID(url) : null;
}

async function extractYoutube(url: string): Promise<UrlImportResult> {
  if (!ytdl.validateURL(url)) throw new UrlImportError("That doesn't look like a valid YouTube video link.");
  const videoId = ytdl.getVideoID(url);
  try {
    return await extractYoutubeViaYtdlCore(url, videoId);
  } catch (e) {
    console.error(
      "[url-import] ytdl-core YouTube lookup failed, falling back to RapidAPI —",
      e instanceof Error ? e.message : e,
    );
    return extractYoutubeViaRapidApi(url, videoId);
  }
}

const RAPIDAPI_DOWNLOAD_HOST = "youtube-info-download-api.p.rapidapi.com";

type RapidApiDownloadStart = { success?: boolean; progress_url?: string };
type RapidApiDownloadProgress = { success?: number; download_url?: string };

// Each fetch below is otherwise unguarded — a hung connection (seen from
// this environment against both this host and i.ytimg.com) would then block
// past even the 2-minute polling budget the loop below thinks it's bounded
// by, since that budget is only checked between iterations, not during a
// single in-flight call.
function fetchWithTimeout(url: string, init: RequestInit | undefined, ms: number): Promise<Response> {
  return Promise.race([
    fetch(url, init),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// The actual video bytes for a YouTube link, via a hosted download API
// rather than resolving a direct googlevideo.com URL ourselves (ytdl-core's
// getInfo hangs against YouTube from this environment — see
// resolveDownloadUrl below). Kicks off an async job, polls its progress_url,
// then fetches the resulting download_url. "720" is a resolution number,
// not a format name — the API's own mp4/best/hd/video/18 aliases all fail
// with "Unknown format." Returns null on any failure (not configured, no
// progress within budget, a bad response) rather than throwing — callers
// treat a missing video as a lesser failure than a missing metadata match.
export async function downloadYoutubeVideo(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const apiKey = process.env.RAPIDAPI_KEY?.trim();
  if (!apiKey) return null;

  try {
    const headers = { "x-rapidapi-host": RAPIDAPI_DOWNLOAD_HOST, "x-rapidapi-key": apiKey };
    const startRes = await fetchWithTimeout(
      `https://${RAPIDAPI_DOWNLOAD_HOST}/ajax/download.php?format=720&add_info=0&url=${encodeURIComponent(url)}`,
      { headers },
      15_000,
    );
    const start = (await startRes.json()) as RapidApiDownloadStart;
    if (!start.success || !start.progress_url) return null;

    const deadline = Date.now() + 2 * 60_000;
    let downloadUrl: string | null = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const progressRes = await fetchWithTimeout(start.progress_url, undefined, 10_000).catch(() => null);
      if (!progressRes) continue;
      const progress = (await progressRes.json()) as RapidApiDownloadProgress;
      if (progress.success === 1 && progress.download_url) {
        downloadUrl = progress.download_url;
        break;
      }
    }
    if (!downloadUrl) return null;

    const fileRes = await fetchWithTimeout(downloadUrl, undefined, 30_000);
    if (!fileRes.ok) return null;
    return { buffer: Buffer.from(await fileRes.arrayBuffer()), mime: fileRes.headers.get("content-type") ?? "video/mp4" };
  } catch (e) {
    console.error("[url-import] RapidAPI YouTube video download failed —", e instanceof Error ? e.message : e);
    return null;
  }
}

// The video's thumbnail. Tried this via the same host's info endpoint
// (/ajax/api.php?function=i) first — its response is otherwise rich and
// accurate, but the top-level thumbnail field it returns for the requested
// video itself is broken (always .../vi/undefined/..., even though it
// correctly resolves other videos' thumbnails in its own relatedVideos
// list). i.ytimg.com's own CDN needs no API call at all: it's a plain,
// unauthenticated URL that exists for every public upload — but a video
// without a real maxresdefault (most don't) still 200s there with a fixed
// 120x90, ~1KB grey placeholder rather than 404ing, so size (not status) is
// what actually tells a real thumbnail apart — a real hqdefault, the
// smallest size YouTube guarantees for nearly every video, is itself
// ~10x that.
const PLACEHOLDER_MAX_BYTES = 5000;

export async function fetchYoutubeThumbnail(videoId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  for (const size of ["maxresdefault", "hqdefault"]) {
    try {
      const res = await fetchWithTimeout(`https://i.ytimg.com/vi/${videoId}/${size}.jpg`, undefined, 15_000);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength < PLACEHOLDER_MAX_BYTES) continue;
      return { buffer, mime: "image/jpeg" };
    } catch {
      continue;
    }
  }
  return null;
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
    videoId: null,
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
  return {
    channelId: null,
    description,
    handle: handleMatch ? `@${handleMatch[1]}` : null,
    platform,
    sourceUrl: url,
    tags,
    thumbnailUrl,
    title,
    videoId: null,
    videoUrl,
  };
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
    videoId: null,
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
