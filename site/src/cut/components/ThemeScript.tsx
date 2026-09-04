import Script from "next/script";

export const THEME_STORAGE_KEY = "cut.theme";

// Inline, synchronous-as-soon-as-it-loads, and rendered ahead of the rest of
// the app subtree so it runs before first paint — the same trick every
// theme-switcher needs to avoid a flash of the wrong theme while React is
// still hydrating. Not a client component: passed as ThemeProvider's child
// from the (server) layout, so its own re-renders never carry this script
// into the client's own render path. next/script over a raw <script> tag for
// the same reason from the other direction — Script doesn't return a literal
// <script> host element at all (it manages the tag via an effect), so even
// Next's own Fast Refresh re-delivering this Server Component's output into
// the client tree during local dev — which happens on any edit anywhere in
// the route's module graph, unrelated to this file — never re-renders one
// either. A raw <script> element only tolerates the very first, real
// hydration pass; Script tolerates being processed any number of times.
//
// `defaultTheme` (admin/settings/general) is read by the caller — cut/app/layout.tsx
// — and passed in as a plain prop rather than read here directly: this file
// sits right on the boundary into ThemeProvider ("use client"), and an async
// component here pulling in publicSiteSettings()'s Prisma import chain broke
// the client bundle even though it's only ever rendered server-side. A plain
// string prop has no module graph of its own to leak.
export function ThemeScript({ defaultTheme }: { defaultTheme: string }) {
  const script = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var mode=t||${JSON.stringify(defaultTheme)};var d=mode==="dark"||(mode==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
  return <Script id="cut-theme-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: script }} />;
}
