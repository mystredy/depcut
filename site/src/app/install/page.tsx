import { notFound } from "next/navigation";

// The Mac app isn't promoted or installable from the site right now — this
// route 404s instead of serving install instructions. Still passed through
// by src/proxy.ts (see PASSTHROUGH there), so it 404s cleanly rather than
// falling into the generic "/…" → "/cut/…" rewrite.
export default function InstallPage(): never {
  notFound();
}
