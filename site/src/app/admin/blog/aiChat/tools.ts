// The blog chat agent's tool catalog and dispatcher. Deliberately small —
// covers everything the old one-shot "Write with AI" dialog did (title,
// body, and now excerpt/tags too), plus setting a cover from a URL, nothing
// more:
//  - set_slug is left out: the slug already auto-derives from the title
//    (see PostEditor's slugify/slugTouched) unless hand-edited, and a direct
//    tool would bypass the uniqueness check the PATCH route does.
//  - set_published is left out: a real go-live action, not something an
//    agent should default to doing.
//  - There's no selection-scoped partial edit (the old dialog's "revise
//    just this selection") — a persistent panel has no "what was selected
//    when I opened this" moment. update_content replaces the whole body.
//  - set_cover_from_url takes a URL rather than generating/uploading a file
//    directly — the chat agent has no image-gen tool or file picker here,
//    only text turns, so a URL (the user's own, or one they found) is the
//    only input it can realistically act on.

export type BlogAiToolName = "set_title" | "set_excerpt" | "set_tags" | "update_content" | "set_cover_from_url";

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
};

export type BlogToolResult = { ok: true; summary: string } | { ok: false; error: string };

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
    default:
      return { error: `Unknown tool: ${name}`, ok: false };
  }
}
