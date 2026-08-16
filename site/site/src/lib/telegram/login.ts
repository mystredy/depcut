import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// A signed data-check fails open (returns false) on any malformed input —
// callers should treat "not verified" as the only safe default.
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

// Verifies a Telegram Login Widget payload against the bot's own token —
// this is the whole trust mechanism (no separate Client ID/Secret; the bot
// token doubles as the signing key). See
// https://core.telegram.org/widgets/login#checking-authorization.
export function verifyTelegramLoginAuth(
  payload: Record<string, string>,
  botToken: string,
): boolean {
  const { hash, ...fields } = payload;
  if (!hash || !botToken) return false;

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate)) return false;
  const ageSeconds = Date.now() / 1000 - authDate;
  return ageSeconds >= 0 && ageSeconds < MAX_AUTH_AGE_SECONDS;
}
