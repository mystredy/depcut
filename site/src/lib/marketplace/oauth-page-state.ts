import { createHmac } from "node:crypto";

// Signs the short-lived "which Page do you want to connect" payload shown
// by the Facebook/Instagram picker step in the OAuth popup — the candidate
// Pages (each with its own Page access token from Meta's /me/accounts) ride
// inside the signed blob so the picker's follow-up request can't be
// tampered with client-side, without needing server-side session storage.
// Same HMAC approach as oauth-state.ts, kept separate since the payload
// shape and purpose differ.
export type CandidatePage = {
  id: string;
  name: string;
  accessToken: string;
  profileImage?: string;
};

type PageStatePayload = {
  platform: string;
  role: "source" | "destination";
  label?: string;
  pages: CandidatePage[];
  ownerType?: "admin" | "studio";
  studioId?: string;
  iat: number;
};

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signPageState(payload: Omit<PageStatePayload, "iat">): string {
  const body = base64url(JSON.stringify({ ...payload, iat: Date.now() }));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPageState(state: string): PageStatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as PageStatePayload;
    if (Date.now() - payload.iat > 10 * 60 * 1000) return null; // 10 minute window
    return payload;
  } catch {
    return null;
  }
}
