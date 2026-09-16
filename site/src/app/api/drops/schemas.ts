import { z } from "zod";

// Hashtags arrive as free text ("#dance #fun" or "dance, fun") and get
// split/cleaned here — the client sends one string, not a pre-split array,
// so this is the one place that decides what counts as a tag. Shared by the
// create route and the publish route, since both can set hashtags.
export const hashtagsSchema = z
  .string()
  .trim()
  .max(280)
  .optional()
  .transform((raw) =>
    (raw ?? "")
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 30)
  );
