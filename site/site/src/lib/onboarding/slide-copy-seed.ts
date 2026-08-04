// Default copy for the six onboarding slides, matching what was previously
// hardcoded in each slide component. OnboardingSlide self-seeds from this
// list on first read — see slide-copy.ts.
export const ONBOARDING_SLIDE_SEED = [
  {
    body: "Chat to edit videos. Generate the shots you don't have.",
    headline: "The AI video editor that works anywhere.",
    slug: "welcome",
  },
  {
    body: "Pick as many as apply — it tells us where to show up next.",
    headline: "How did you hear about us?",
    slug: "referral",
  },
  {
    body: "Same editor. Choose what works for you.\n\nAutomatically switches between cloud and local when available.",
    headline: "Works in the cloud or on your Mac",
    slug: "modes",
  },
  {
    body: "Already in your account — nothing to claim. Spend it on generated video, audio and images.",
    headline: null,
    slug: "credits",
  },
  {
    body: "The AI has access to your entire project. Ask it to trim clips, generate missing shots, write subtitles, add voiceovers, rearrange your timeline, or answer questions about your footage.\n\nWorks out of the box with Gemini, or use your own Claude or Codex subscription.",
    headline: "Chat with your editor.",
    slug: "ai_chat",
  },
  {
    body: "The editor is free. Pay only for AI generated media.",
    headline: "Simple pricing",
    slug: "plans",
  },
] as const;

export type OnboardingSlideSlug = (typeof ONBOARDING_SLIDE_SEED)[number]["slug"];

export const ONBOARDING_SLIDE_DEFAULTS: Record<
  OnboardingSlideSlug,
  { headline: string | null; body: string }
> = Object.fromEntries(
  ONBOARDING_SLIDE_SEED.map((s) => [s.slug, { body: s.body, headline: s.headline }]),
) as Record<OnboardingSlideSlug, { headline: string | null; body: string }>;
