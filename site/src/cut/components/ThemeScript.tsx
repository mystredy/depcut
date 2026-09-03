export const THEME_STORAGE_KEY = "cut.theme";

// Inline, synchronous, and rendered ahead of the rest of the app subtree so
// it runs before first paint — the same trick every theme-switcher needs to
// avoid a flash of the wrong theme while React is still hydrating. Deliberately
// not a client component: passed as ThemeProvider's child from the (server)
// layout, it renders once into the initial HTML and the browser executes it
// as it parses that HTML. A client component here would re-render this
// `<script>` on every client-side navigation — and a script tag React (re-)
// renders on the client never runs, since a browser only executes a script
// tag that was present in HTML it parsed, not one a script inserts later.
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
