import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram/notify";

export type DepCutAuthContext = {
  platform: "api";
  app: "depcut";
  method: "session-cookie" | "dev-bypass" | "api-key";
  clientId: string | null;
  // The app's active conversation for this request, from x-depcut-conversation-id.
  // Null for background work (vision warming) and non-app callers (Vision API keys).
  conversationId: string | null;
  userId: string;
  apiKeyId: string | null;
};

export type DepCutAuthOptions = {
  // Routes are session-only by default. Set true to also accept a Vision API
  // key as a bearer token. This is the typed allowlist for "which routes
  // support API keys" — no path string matching.
  allowApiKey?: boolean;
};

export type DepCutAuthenticatedRequest = NextRequest & {
  depcut: DepCutAuthContext;
};

// The real signed-in user's id, or null for api-key / dev-bypass callers. Use
// this in session-only product routes (billing, API-key management) instead of
// re-calling auth.api.getSession — withDepCutAuth already authenticated.
export function depcutSessionUserId(
  request: DepCutAuthenticatedRequest,
): string | null {
  return request.depcut.method === "session-cookie"
    ? request.depcut.userId
    : null;
}

// The single response for any access-control failure (no session, no
// subscription). Routes return this rather than per-case descriptive errors.
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Generic 404 for any missing resource. Routes return this rather than per-case
// descriptive not-found errors.
export function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// True when the request comes from Vercel's cron scheduler, which sends the
// project's CRON_SECRET env var as a bearer token on every invocation.
export function isVercelCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

export type DepCutAuthHandler<
  TReq extends DepCutAuthenticatedRequest = DepCutAuthenticatedRequest,
  TArgs extends unknown[] = [],
> = (request: TReq, ...args: TArgs) => Promise<Response> | Response;

const clientIdHeader = "x-depcut-client-id";
const conversationIdHeader = "x-depcut-conversation-id";
const devAuthBypassHeader = "x-depcut-dev-auth-bypass";
const devAuthBypassUserID = "depcut-dev-auth-bypass";

function conversationIdFromHeaders(headers: Headers): string | null {
  const value = headers.get(conversationIdHeader)?.trim();
  return value ? value : null;
}

export async function getDepCutAuthContext(
  headers: Headers,
): Promise<DepCutAuthContext | null> {
  const devBypass = devAuthBypassContext(headers);
  if (devBypass) {
    return devBypass;
  }

  const apiKeyContext = await apiKeyAuthContext(headers);
  if (apiKeyContext) {
    return apiKeyContext;
  }

  const session = await auth.api.getSession({
    headers,
  });
  if (!session) {
    return null;
  }

  const clientId = headers.get(clientIdHeader)?.trim();

  return {
    platform: "api",
    app: "depcut",
    method: "session-cookie",
    clientId: clientId ? clientId : null,
    conversationId: conversationIdFromHeaders(headers),
    userId: session.user.id,
    apiKeyId: null,
  };
}

// Vision API keys are sent as a bearer token; that is the only accepted format.
function apiKeyFromHeaders(headers: Headers): string | null {
  const authorization = headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();
  return token ? token : null;
}

async function apiKeyAuthContext(
  headers: Headers,
): Promise<DepCutAuthContext | null> {
  const key = apiKeyFromHeaders(headers);
  if (!key) {
    return null;
  }

  const verified = await auth.api.verifyApiKey({ body: { key } });
  if (!verified.valid || !verified.key) {
    return null;
  }

  const clientId = headers.get(clientIdHeader)?.trim();

  return {
    platform: "api",
    app: "depcut",
    method: "api-key",
    // The Vision API does not require x-depcut-client-id; default it to the key
    // id so downstream usage records and rate-limit buckets stay per-key.
    clientId: clientId ? clientId : verified.key.id,
    // Vision API keys have no app conversation; honor the header if sent, else null.
    conversationId: conversationIdFromHeaders(headers),
    userId: verified.key.referenceId,
    apiKeyId: verified.key.id,
  };
}

export function shouldBypassDepCutInferenceCredits(
  authContext: DepCutAuthContext,
) {
  return authContext.method === "dev-bypass";
}

function devAuthBypassContext(headers: Headers): DepCutAuthContext | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  if (headers.get(devAuthBypassHeader)?.trim() !== "1") {
    return null;
  }

  const clientId = headers.get(clientIdHeader)?.trim();

  return {
    platform: "api",
    app: "depcut",
    method: "dev-bypass",
    clientId: clientId ? clientId : null,
    conversationId: conversationIdFromHeaders(headers),
    userId: devAuthBypassUserID,
    apiKeyId: null,
  };
}

export function withDepCutAuth<
  TReq extends DepCutAuthenticatedRequest = DepCutAuthenticatedRequest,
  TArgs extends unknown[] = [],
>(handler: DepCutAuthHandler<TReq, TArgs>, options: DepCutAuthOptions = {}) {
  return async (request: NextRequest, ...args: TArgs) => {
    const authContext = await getDepCutAuthContext(request.headers);

    if (!authContext) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required",
        },
        {
          status: 401,
        },
      );
    }

    if (authContext.method === "api-key" && !options.allowApiKey) {
      return NextResponse.json(
        {
          error: "api_key_not_permitted_for_route",
          message: "API keys are not accepted on this route.",
        },
        {
          status: 401,
        },
      );
    }

    const authenticatedRequest = Object.assign(request, {
      depcut: authContext,
    }) as TReq;

    try {
      return await handler(authenticatedRequest, ...args);
    } catch (error) {
      // A deliberate NextResponse.json(..., {status: 4xx}) return never
      // reaches here — only a genuine thrown exception does, so this alerts
      // on real bugs, not routine validation rejections. Fire-and-forget so
      // a Telegram hiccup never adds latency to an already-failing request;
      // the error is re-thrown unchanged so the framework's own handling
      // (and the client's response) stays exactly as it was before this.
      const message = error instanceof Error ? error.message : String(error);
      void notifyTelegram(
        "systemError",
        `🚨 ${request.method} ${request.nextUrl.pathname}\nuser: ${authContext.userId}\n${message}`,
      );
      throw error;
    }
  };
}

export async function isDepCutSuperUser(userId: string) {
  const user = await prisma.user.findUnique({
    select: {
      superUser: true,
    },
    where: {
      id: userId,
    },
  });

  return user?.superUser === true;
}
