import type { ReactNode } from "react";

import { SettingsGuard } from "@/cut/components/SettingsGuard";

// Same session guard as My Space — viewing any Space needs a signed-in
// account.
export default function BrandSpaceLayout({ children }: { children: ReactNode }) {
  return <SettingsGuard>{children}</SettingsGuard>;
}
