"use client";

import { Check } from "lucide-react";

import { Eyebrow, GlassCard, GradientButton } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { GRADIENT } from "@/app/cut/_components/landing/dark/theme";
import { useAppEntryHref } from "@/app/_components/landing/useAppEntryHref";
import { cutPricingPlans } from "@/app/cut/_components/landing/cutPricingPlans";

export function CutPricing() {
  const appHref = useAppEntryHref();

  // Both plan CTAs enter the app, so gate them the same way as the hero: a
  // signed-out click lands on sign-in first, then returns to the app target.
  const plans = cutPricingPlans().map((plan) => ({
    ...plan,
    action: { ...plan.action, href: appHref(plan.action.href) },
  }));

  return (
    <section id="pricing" className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-28">
      <div className="flex flex-col items-center text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="mt-6 text-[clamp(32px,4.5vw,52px)] font-semibold leading-[1.05] tracking-[-0.01em] text-white">
          Simple pricing
        </h2>
        <p className="mt-5 max-w-[600px] text-[17px] leading-[1.6] text-white/60">
          The editor is free. Pay only for AI generated media.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-[820px] grid-cols-1 items-stretch gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isPro = plan.name === "Pro";
          return (
            <div
              key={plan.name}
              className="relative rounded-[20px] p-px"
              style={{ background: isPro ? GRADIENT : "rgba(255,255,255,0.09)" }}
            >
              <GlassCard fill glow={isPro} tint={isPro ? "violet" : "blue"}>
                <div className="flex h-full flex-col p-8">
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-semibold text-white">{plan.name}</span>
                    {isPro && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                        style={{ backgroundImage: GRADIENT }}
                      >
                        Most popular
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-[44px] font-semibold leading-none tracking-[-0.02em] text-white">
                      {plan.price}
                    </span>
                  </div>
                  <div className="mt-3 text-[13px] font-semibold text-white/45">{plan.detail}</div>
                  <p className="mt-4 text-[15px] leading-[1.55] text-white/65">{plan.body}</p>

                  <div className="mt-6 grid gap-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2.5 text-[14px] font-medium text-white/80">
                        <span
                          className="flex size-[22px] shrink-0 items-center justify-center rounded-full"
                          style={{ background: "rgba(255,255,255,0.08)" }}
                        >
                          <Check size={13} className="text-white" />
                        </span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <GradientButton href={plan.action.href} variant={isPro ? "gradient" : "ghost"} size="md">
                      {plan.action.label}
                    </GradientButton>
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-[14px] leading-[1.6] text-white/40">
        * Buy credits for AI generated content at any time.
      </p>
    </section>
  );
}
