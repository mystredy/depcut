import type { ReactNode } from "react";

import { SettingsGuard } from "@/cut/components/SettingsGuard";

// Accepting an invite needs a signed-in account — the one the invite was
// actually sent to, checked server-side by the accept route.
export default function StudioInviteLayout({ children }: { children: ReactNode }) {
  return <SettingsGuard>{children}</SettingsGuard>;
}
