import { createHash, createHmac, randomBytes } from "node:crypto";

// Signs the OAuth `state` param so the callback route can trust it came from
// a start request we issued, without needing server-side session storage —
// the PKCE code_verifier (when used) travels inside the signed payload
// itself. Reuses BETTER_AUTH_SECRET rather than provisioning a new secret.
type StatePayload = {
  platform: string;
  role: "source" | "destination";
  label?: string;
  verifier?: string;
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

export function signOAuthState(payload: Omit<StatePayload, "iat">): string {
  const body = base64url(JSON.stringify({ ...payload, iat: Date.now() }));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as StatePayload;
    if (Date.now() - payload.iat > 10 * 60 * 1000) return null; // 10 minute window
    return payload;
  } catch {
    return null;
  }
}

export function generatePkcePair() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { challenge, verifier };
}
