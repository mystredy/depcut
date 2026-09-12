import type { ReactNode } from "react";

import { SettingsGuard } from "@/cut/components/SettingsGuard";

// Same session guard as the Space hub — viewing any studio needs a
// signed-in account.
export default function StudioLayout({ children }: { children: ReactNode }) {
  return <SettingsGuard>{children}</SettingsGuard>;
}
