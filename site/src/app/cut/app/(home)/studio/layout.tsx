import type { ReactNode } from "react";

import { SettingsGuard } from "@/cut/components/SettingsGuard";

// Same session guard as Billing/Usage — a studio needs a signed-in account
// to have anything to show.
export default function StudioHubLayout({ children }: { children: ReactNode }) {
  return <SettingsGuard>{children}</SettingsGuard>;
}
