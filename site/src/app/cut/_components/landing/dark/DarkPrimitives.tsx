"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import {
  BORDER,
  BORDER_STRONG,
  GRADIENT,
  SURFACE,
  TEXT,
  TEXT_MUTED,
  TINTS,
  type Tint,
} from "@/app/cut/_components/landing/dark/theme";

function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

// Same reasoning as the cream system's PillButton: auth pages are proxy
// passthrough routes App Router soft-navigation can't cross, so they need a
// full-page anchor, not next/link.
function isAuthPassthroughHref(href: string) {
  return href.startsWith("/sign-in") || href.startsWith("/sign-up");
}

type ButtonVariant = "gradient" | "solid" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type GradientButtonProps = {
  ariaLabel?: string;
  children: ReactNode;
  href?: string;
  onClick?: () => void | Promise<void>;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function GradientButton({
  ariaLabel,
  children,
  href,
  onClick,
  size = "md",
  variant = "gradient",
}: GradientButtonProps) {
  const sizes: Record<ButtonSize, CSSProperties> = {
    sm: { padding: "9px 18px", fontSize: 14 },
    md: { padding: "13px 24px", fontSize: 15 },
    lg: { padding: "17px 32px", fontSize: 16 },
  };
  const variants: Record<ButtonVariant, CSSProperties> = {
    gradient: { backgroundImage: GRADIENT, color: "#fff", border: "1px solid transparent" },
    solid: { background: TEXT, color: "#08070C", border: "1px solid transparent" },
    ghost: { background: "rgba(255,255,255,0.04)", color: TEXT, border: `1px solid ${BORDER_STRONG}` },
  };
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: "transform 0.15s ease, opacity 0.15s ease",
    ...sizes[size],
    ...variants[variant],
  };

  if (href) {
    if (isInternalHref(href) && !isAuthPassthroughHref(href)) {
      return (
        <Link aria-label={ariaLabel} href={href} onClick={onClick} style={style}>
          {children}
        </Link>
      );
    }
    return (
      <a aria-label={ariaLabel} href={href} onClick={onClick} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button aria-label={ariaLabel} onClick={onClick} style={style} type="button">
      {children}
    </button>
  );
}

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  fill?: boolean;
  glow?: boolean;
  tint?: Tint;
};

// The recurring surface: a translucent panel with a hairline border, a soft
// radial glow in the tint color behind it, and a subtle lift on hover.
export function GlassCard({ children, className, fill = false, glow = true, tint = "violet" }: GlassCardProps) {
  const color = TINTS[tint];
  return (
    <div
      className={className}
      style={{
        position: "relative",
        boxSizing: "border-box",
        height: fill ? "100%" : undefined,
        borderRadius: 20,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        overflow: "hidden",
      }}
    >
      {glow && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: color.glow,
            filter: "blur(48px)",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ position: "relative", height: fill ? "100%" : undefined }}>{children}</div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        border: `1px solid ${BORDER_STRONG}`,
        background: "rgba(255,255,255,0.03)",
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: TEXT_MUTED,
      }}
    >
      {children}
    </div>
  );
}
