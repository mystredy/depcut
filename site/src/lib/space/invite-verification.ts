import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Gates a Brand Space manager invite behind a one-time code emailed to the
// INVITING manager's own address — proof a human with inbox access approved
// this specific invite, not just that the browser session is authenticated,
// before the actual invite email goes out to the invitee. Stateless like
// lib/admin/action-verification.ts: the code's hash and the invite it
// authorizes travel inside the signed challenge itself, so there's no DB row
// to add or expire.
type ChallengePayload = {
  requesterId: string;
  brandSpaceId: string;
  email: string;
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

export function generateInviteCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createInviteChallenge(params: {
  requesterId: string;
  brandSpaceId: string;
  email: string;
  code: string;
}): string {
  const payload: ChallengePayload = {
    brandSpaceId: params.brandSpaceId,
    codeHash: hashCode(params.code),
    email: params.email,
    iat: Date.now(),
    requesterId: params.requesterId,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyInviteChallenge(params: {
  challenge: string;
  code: string;
  requesterId: string;
  brandSpaceId: string;
  email: string;
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
  if (
    payload.requesterId !== params.requesterId ||
    payload.brandSpaceId !== params.brandSpaceId ||
    payload.email !== params.email
  ) {
    return false;
  }

  return timingSafeStringsEqual(hashCode(params.code), payload.codeHash);
}
