import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Gates studio deletion behind a one-time code sent to the OWNER's own
// email (and Telegram, if linked) — proof a human with access to those
// actually approved this specific deletion, not just that the browser
// session is authenticated. Stateless like invite-verification.ts: the
// code's hash and the studio it authorizes travel inside the signed
// challenge itself, so there's no DB row to add or expire.
type ChallengePayload = {
  requesterId: string;
  studioId: string;
  codeHash: string;
  iat: number;
};

const EXPIRY_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("base64url");
}

function timingSafeStringsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function generateDeleteCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createDeleteChallenge(params: {
  requesterId: string;
  studioId: string;
  code: string;
}): string {
  const payload: ChallengePayload = {
    codeHash: hashCode(params.code),
    iat: Date.now(),
    requesterId: params.requesterId,
    studioId: params.studioId,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyDeleteChallenge(params: {
  challenge: string;
  code: string;
  requesterId: string;
  studioId: string;
}): boolean {
  const [body, sig] = params.challenge.split(".");
  if (!body || !sig) return false;
  if (!timingSafeStringsEqual(sig, sign(body))) return false;

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return false;
  }

  if (Date.now() - payload.iat > EXPIRY_MS) return false;
  if (payload.requesterId !== params.requesterId || payload.studioId !== params.studioId) return false;

  return timingSafeStringsEqual(hashCode(params.code), payload.codeHash);
}
