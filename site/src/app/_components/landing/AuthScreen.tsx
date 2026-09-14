"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CutFooter } from "@/app/cut/_components/landing/CutFooter";
import { CutTopNav } from "@/app/cut/_components/landing/CutTopNav";
import { GlassCard } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { BG, GRADIENT_TEXT, TEXT, TEXT_FAINT, TEXT_MUTED } from "@/app/cut/_components/landing/dark/theme";
import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate/constants";
import { authClient, useHydrationSafeSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const REF_CODE_RE = /^[A-Z0-9]{4,16}$/;
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type AuthMode = "sign-in" | "sign-up";

type Props = {
  mode: AuthMode;
};

const copy = {
  "sign-in": {
    alternateHref: "/sign-up",
    alternateLabel: "Create account",
    alternateLead: "New to DepCut?",
    googleAlt: "Sign in with Google",
    googleSrc: "/google/sign-in-with-google.svg",
    googleWidth: 175,
    headingLead: "Send DepCut",
    headingHighlight: "back to work.",
    title: "Log in",
  },
  "sign-up": {
    alternateHref: "/sign-in",
    alternateLabel: "Log in",
    alternateLead: "Already have an account?",
    googleAlt: "Sign up with Google",
    googleSrc: "/google/sign-up-with-google.svg",
    googleWidth: 179,
    headingLead: "Put DepCut",
    headingHighlight: "to Work",
    title: "Sign up",
  },
} satisfies Record<
  AuthMode,
  {
    alternateHref: string;
    alternateLabel: string;
    alternateLead: string;
    googleAlt: string;
    googleSrc: string;
    googleWidth: number;
    headingLead: string;
    headingHighlight: string;
    title: string;
  }
>;

const GOOGLE_BUTTON_HEIGHT = 56;

export function AuthScreen({ mode }: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const screenCopy = copy[mode];
  const otherMode: AuthMode = mode === "sign-in" ? "sign-up" : "sign-in";

  // An already-signed-in visitor gets nothing from this form — worse,
  // clicking "Sign in with Google" while already authenticated just re-runs
  // the full OAuth redirect round-trip for no reason, which reads as the
  // page being broken or slow. Bounce straight to the same callback target
  // the button itself would use, as soon as the session resolves.
  // useHydrationSafeSession (not the raw authClient.useSession) is what
  // keeps the form itself from being a hydration mismatch for a
  // client-only-resolved signed-in visitor — see its own doc comment.
  const { data: session } = useHydrationSafeSession();
  useEffect(() => {
    if (!session) return;
    const searchParams = new URLSearchParams(window.location.search);
    router.replace(searchParams.get("callbackURL") ?? "/app");
  }, [session, router]);

  // A referral link is /sign-up?ref=CODE. The code rides a cookie (not the
  // URL) across the Google OAuth round-trip, so it's still readable from
  // auth.ts's user.create hook once the callback lands and creates the
  // account — by then the ?ref= query param itself is long gone.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref")?.toUpperCase();
    if (ref && REF_CODE_RE.test(ref)) {
      document.cookie = `${AFFILIATE_REF_COOKIE}=${ref}; path=/; max-age=${REF_COOKIE_MAX_AGE}; SameSite=Lax`;
    }
  }, []);

  const handleGoogleAuth = useCallback(async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const callbackURL = searchParams.get("callbackURL") ?? "/app";

    setIsPending(true);
    setStatusMessage(null);

    try {
      await authClient.signIn.social({
        callbackURL,
        // A brand-new account lands on the welcome sequence's own address, so
        // its first paint is the sequence rather than the app home.
        newUserCallbackURL: "/app/onboarding",
        provider: "google",
      });
    } catch {
      setStatusMessage("Google sign-in could not start. Please try again.");
    } finally {
      setIsPending(false);
    }
  }, []);

  const googleButtonWidth = Math.round(
    (screenCopy.googleWidth * GOOGLE_BUTTON_HEIGHT) / 40,
  );

  // Once the session resolves signed-in, the redirect effect above is about
  // to navigate away — the form swaps out so there's nothing left to click
  // through during that window, same as CutTopNav's own signed-in swap.
  const formContent = session ? (
    <p className="text-sm leading-normal" style={{ color: TEXT_MUTED }}>
      You&apos;re already signed in — redirecting…
    </p>
  ) : (
    <>
      <button
        type="button"
        aria-label={screenCopy.googleAlt}
        disabled={isPending}
        onClick={handleGoogleAuth}
        className={cn(
          "inline-flex border-none bg-transparent p-0",
          isPending ? "cursor-default opacity-60" : "cursor-pointer",
        )}
      >
        <Image
          src={screenCopy.googleSrc}
          alt={screenCopy.googleAlt}
          width={screenCopy.googleWidth}
          height={40}
          priority
          unoptimized
          className="block h-14"
          style={{ width: googleButtonWidth }}
        />
      </button>
      <p className="mt-[18px] text-sm leading-normal" style={{ color: TEXT_MUTED }}>
        {screenCopy.alternateLead}{" "}
        <Link
          href={screenCopy.alternateHref}
          className="font-semibold text-white underline underline-offset-[3px]"
        >
          {screenCopy.alternateLabel}
        </Link>
      </p>
      <p className="mt-[18px] text-xs leading-normal" style={{ color: TEXT_FAINT }}>
        By continuing, you agree to the{" "}
        <Link href="/terms" className="font-semibold text-white/80 hover:text-white">
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold text-white/80 hover:text-white">
          Privacy Policy
        </Link>
        .
      </p>
      {statusMessage ? (
        <div role="status" className="mt-[14px] text-[13px] font-semibold leading-[1.4] text-rose-300">
          {statusMessage}
        </div>
      ) : null}
    </>
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background: BG,
        color: TEXT,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      {/* Same html/body override + overflow guard as the Cut landing page
          (CutLanding.tsx) — see its comment for why both are needed. */}
      <style>{`html, body { background: ${BG}; overflow-x: hidden; }`}</style>
      {/* Auth serves same-host on depcut.com, so the chrome is Cut's. */}
      <CutTopNav
        authToggle={{
          href: screenCopy.alternateHref,
          label: copy[otherMode].title,
        }}
      />
      <section className="relative mx-auto flex w-full max-w-[1400px] flex-col items-center px-6 pt-16 pb-24 text-center md:px-12 md:pt-20 md:pb-32">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2 opacity-40"
          style={{
            background:
              "radial-gradient(closest-side, rgba(139,92,246,0.35), rgba(59,130,246,0.18) 45%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <h1 className="max-w-[720px] text-[clamp(34px,6vw,64px)] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
          {screenCopy.headingLead} <span style={GRADIENT_TEXT}>{screenCopy.headingHighlight}</span>
        </h1>
        <GlassCard className="mt-12 w-full max-w-[420px]" tint="violet">
          <div className="flex flex-col items-center px-8 py-10 text-center">{formContent}</div>
        </GlassCard>
      </section>
      <CutFooter />
    </main>
  );
}
