import type { BlogYoutubeImport } from "@/queries/admin";

// The blog chat agent's tool catalog and dispatcher. Deliberately small —
// covers everything the old one-shot "Write with AI" dialog did (title,
// body, and now excerpt/tags too), plus setting a cover from a URL and
// importing a YouTube video's metadata/transcript, nothing more:
//  - set_slug is left out: the slug already auto-derives from the title
//    (see PostEditor's slugify/slugTouched) unless hand-edited, and a direct
//    tool would bypass the uniqueness check the PATCH route does.
//  - set_published is left out: a real go-live action, not something an
//    agent should default to doing.
//  - There's no selection-scoped partial edit (the old dialog's "revise
//    just this selection") — a persistent panel has no "what was selected
//    when I opened this" moment. update_content replaces the whole body.
//  - set_cover_from_url takes a URL rather than generating/uploading a file
//    directly for the COVER specifically — a real image-gen tool exists now
//    (generate_image, generate_video below) for the post body, but the
//    cover stays URL-only since nothing asks for an AI-generated cover yet.
//  - import_youtube is read-only — it hands the agent a video's title,
//    description, tags, thumbnail, and (best-effort) transcript so it can
//    write the post itself with the other tools; it never touches the post
//    on its own.
//  - generate_image/generate_video are the same read-only shape: each hands
//    back a durable url (never touching the post itself), which the agent
//    then splices into the body itself via update_content — same division
//    of labor as import_youtube, and the reason PostEditor's onInsert
//    equivalents (the manual toolbar's dialogs) aren't reused directly: the
//    agent doesn't pick a spot in the doc the way a toolbar click does, it
//    rewrites the whole body with the reference already in the right place.

export type BlogAiToolName =
  | "set_title"
  | "set_excerpt"
  | "set_tags"
  | "update_content"
  | "set_cover_from_url"
  | "import_youtube"
  | "generate_image"
  | "generate_video"
  | "list_skills"
  | "read_skill";

export type BlogAiToolDef = {
  name: BlogAiToolName;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const BLOG_AI_TOOLS: BlogAiToolDef[] = [
  {
    description: "Set the post's title.",
    inputSchema: {
      additionalProperties: false,
      properties: { title: { description: "The new title.", type: "string" } },
      required: ["title"],
      type: "object",
    },
    name: "set_title",
  },
  {
    description: "Set the post's excerpt — one or two sentences shown in the blog list and link previews.",
    inputSchema: {
      additionalProperties: false,
      properties: { excerpt: { description: "The new excerpt.", type: "string" } },
      required: ["excerpt"],
      type: "object",
    },
    name: "set_excerpt",
  },
  {
    description: "Set the post's tags — short labels shown as clickable chips on the post and its category pages. Replaces the current list.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        tags: { description: "The new list of tags.", items: { type: "string" }, type: "array" },
      },
      required: ["tags"],
      type: "object",
    },
    name: "set_tags",
  },
  {
    description: "Replace the post's whole body with new Markdown content.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        contentMarkdown: { description: "The full replacement body, in Markdown.", type: "string" },
      },
      required: ["contentMarkdown"],
      type: "object",
    },
    name: "update_content",
  },
  {
    description:
      "Set the post's cover image from an image URL (PNG, WebP, or JPEG). Replaces the current cover, if any. Only works on a post that's been saved at least once.",
    inputSchema: {
      additionalProperties: false,
      properties: { url: { description: "URL of the image to use as the cover.", type: "string" } },
      required: ["url"],
      type: "object",
    },
    name: "set_cover_from_url",
  },
  {
    description:
      "Fetch a YouTube video's title, description, tags, thumbnail URL, and transcript (when available), to write a blog post from. Read-only — call set_title/set_excerpt/set_tags/update_content/set_cover_from_url afterward to actually build the post from what this returns.",
    inputSchema: {
      additionalProperties: false,
      properties: { url: { description: "The YouTube video URL.", type: "string" } },
      required: ["url"],
      type: "object",
    },
    name: "import_youtube",
  },
  {
    description:
      "Generate an image from a text prompt and get back a durable url to it. Read-only — it doesn't touch the post. Call update_content afterward with Markdown image syntax (![alt text](url)) inserted at the right spot in the body to actually add it. Only works on a post that's been saved at least once.",
    inputSchema: {
      additionalProperties: false,
      properties: { prompt: { description: "What the image should show.", type: "string" } },
      required: ["prompt"],
      type: "object",
    },
    name: "generate_image",
  },
  {
    description:
      "Generate a short video clip from a text prompt and get back a durable url to it. Read-only — it doesn't touch the post. Call update_content afterward with a plain Markdown link to the url (e.g. [▶ Watch video](url)) inserted at the right spot in the body — the public post page renders that exact link shape as a real playable embed automatically, so nothing more is needed. Only works on a post that's been saved at least once.",
    inputSchema: {
      additionalProperties: false,
      properties: { prompt: { description: "What the video should show.", type: "string" } },
      required: ["prompt"],
      type: "object",
    },
    name: "generate_video",
  },
  {
    description:
      "List the names of every skill an admin has written for you at /admin/ai/skills — a playbook for a recurring editorial pattern this post might call for. Read one with read_skill before working in an area you're unsure about.",
    inputSchema: { additionalProperties: false, properties: {}, type: "object" },
    name: "list_skills",
  },
  {
    description: "Read one skill's full instructions by name (see list_skills).",
    inputSchema: {
      additionalProperties: false,
      properties: { name: { description: "The skill's name, from list_skills.", type: "string" } },
      required: ["name"],
      type: "object",
    },
    name: "read_skill",
  },
];

// The setters PostEditor already has — a tool call runs one of these
// directly (never a DB write), so an AI edit flows through the exact same
// dirty/autosave path a manual edit does. setCoverFromUrl is the one
// exception: the cover isn't part of the editor's own draft state, it's
// already-persisted R2 storage (see api/admin/blog/[id]/cover), so that
// action is a real network request rather than a local state update.
export type BlogEditorActions = {
  setTitle: (title: string) => void;
  setExcerpt: (excerpt: string) => void;
  setTags: (tags: string[]) => void;
  setContent: (contentMarkdown: string) => void;
  setCoverFromUrl: (url: string) => Promise<void>;
  importYoutube: (url: string) => Promise<BlogYoutubeImport>;
  generateImage: (prompt: string) => Promise<string>;
  generateVideo: (prompt: string) => Promise<string>;
  listSkills: () => Promise<{ skills: string[] }>;
  readSkill: (name: string) => Promise<string>;
};

// `data` rides along on a successful import_youtube call — the model reads
// the whole result object (see useBlogAiChat's function_response), while the
// UI chip shows only `summary`, so the fetched title/description/tags/
// transcript don't get rendered as a wall of text in the chat.
export type BlogToolResult =
  | { ok: true; summary: string; data?: unknown }
  | { ok: false; error: string };

export async function runBlogAiTool(
  name: string,
  args: Record<string, unknown>,
  actions: BlogEditorActions,
): Promise<BlogToolResult> {
  switch (name) {
    case "set_title": {
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) return { error: "title is required.", ok: false };
      actions.setTitle(title);
      return { ok: true, summary: `Title set to "${title}".` };
    }
    case "set_excerpt": {
      const excerpt = typeof args.excerpt === "string" ? args.excerpt.trim() : "";
      if (!excerpt) return { error: "excerpt is required.", ok: false };
      actions.setExcerpt(excerpt);
      return { ok: true, summary: "Excerpt updated." };
    }
    case "set_tags": {
      const tags = Array.isArray(args.tags)
        ? args.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
        : [];
      actions.setTags(tags);
      return { ok: true, summary: `Tags set to: ${tags.join(", ") || "(none)"}.` };
    }
    case "update_content": {
      const contentMarkdown = typeof args.contentMarkdown === "string" ? args.contentMarkdown.trim() : "";
      if (!contentMarkdown) return { error: "contentMarkdown is required.", ok: false };
      actions.setContent(contentMarkdown);
      return { ok: true, summary: "Post body updated." };
    }
    case "set_cover_from_url": {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      if (!url) return { error: "url is required.", ok: false };
      try {
        await actions.setCoverFromUrl(url);
        return { ok: true, summary: "Cover image set." };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not set that cover image.", ok: false };
      }
    }
    case "import_youtube": {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      if (!url) return { error: "url is required.", ok: false };
      try {
        const result = await actions.importYoutube(url);
        const parts = [
          result.transcript ? `a ${result.transcript.trim().split(/\s+/).length}-word transcript` : "no transcript",
          `${result.tags.length} tag${result.tags.length === 1 ? "" : "s"}`,
          result.thumbnailUrl ? "a thumbnail" : "no thumbnail",
        ];
        return { data: result, ok: true, summary: `Imported "${result.title}" — ${parts.join(", ")}.` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not import that video.", ok: false };
      }
    }
    case "generate_image": {
      const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      if (!prompt) return { error: "prompt is required.", ok: false };
      try {
        const url = await actions.generateImage(prompt);
        return { data: { url }, ok: true, summary: `Generated an image: ${url}` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not generate that image.", ok: false };
      }
    }
    case "generate_video": {
      const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      if (!prompt) return { error: "prompt is required.", ok: false };
      try {
        const url = await actions.generateVideo(prompt);
        return { data: { url }, ok: true, summary: `Generated a video: ${url}` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not generate that video.", ok: false };
      }
    }
    case "list_skills": {
      const { skills } = await actions.listSkills();
      return { data: { skills }, ok: true, summary: `${skills.length} skill${skills.length === 1 ? "" : "s"} available.` };
    }
    case "read_skill": {
      const skillName = typeof args.name === "string" ? args.name.trim() : "";
      if (!skillName) return { error: "name is required.", ok: false };
      try {
        const body = await actions.readSkill(skillName);
        return { data: { body }, ok: true, summary: `Read skill "${skillName}".` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not read that skill.", ok: false };
      }
    }
    default:
      return { error: `Unknown tool: ${name}`, ok: false };
  }
}
