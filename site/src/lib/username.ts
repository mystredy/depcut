import { z } from "zod";

// The @handle rule for a studio (Studio.username): lowercase letters,
// digits, and underscores, 3-20 characters, starting with a letter.
// superRefine reports the one rule that actually failed (e.g. "Dots aren't
// allowed") instead of dumping the whole spec at every rejection.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({ code: "custom", message: "Username can't be empty." });
      return;
    }
    if (!/^[a-z]/.test(value)) {
      ctx.addIssue({ code: "custom", message: "Username must start with a letter." });
      return;
    }
    const badChar = value.match(/[^a-z0-9_]/)?.[0];
    if (badChar) {
      const label = badChar === "." ? "Dots" : badChar === " " ? "Spaces" : `"${badChar}"`;
      ctx.addIssue({ code: "custom", message: `${label} aren't allowed in usernames.` });
      return;
    }
    if (value.length < 3) {
      ctx.addIssue({ code: "custom", message: "Username must be at least 3 characters." });
      return;
    }
    if (value.length > 20) {
      ctx.addIssue({ code: "custom", message: "Username can't be longer than 20 characters." });
    }
  });
