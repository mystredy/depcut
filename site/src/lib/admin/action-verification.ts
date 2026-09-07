import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Gates a high-privilege admin action (granting/revoking super-user) behind
// a one-time code emailed to the ACTING admin's own address — proof a human
// with inbox access approved this specific action, not just that the
// browser session is authenticated (a stray click, a hijacked session, a
// shared machine). Stateless like lib/marketplace/oauth-state.ts's signed
// state param: the code's hash and the action it authorizes travel inside
// the signed challenge itself, so there's no DB row to add or expire.
export type AdminAction = "grant-super-user" | "revoke-super-user";

type ChallengePayload = {
  adminUserId: string;
  targetUserId: string;
  action: AdminAction;
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

export function generateActionCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createActionChallenge(params: {
  adminUserId: string;
  targetUserId: string;
  action: AdminAction;
  code: string;
}): string {
  const payload: ChallengePayload = {
    action: params.action,
    adminUserId: params.adminUserId,
    codeHash: hashCode(params.code),
    iat: Date.now(),
    targetUserId: params.targetUserId,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyActionChallenge(params: {
  challenge: string;
  code: string;
  adminUserId: string;
  targetUserId: string;
  action: AdminAction;
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
    payload.adminUserId !== params.adminUserId ||
    payload.targetUserId !== params.targetUserId ||
    payload.action !== params.action
  ) {
    return false;
  }

  return timingSafeStringsEqual(hashCode(params.code), payload.codeHash);
}
