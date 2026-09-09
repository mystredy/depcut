import type { ReactNode } from "react";

import { ArtistGuard } from "@/cut/components/ArtistGuard";

export default function PayoutsLayout({ children }: { children: ReactNode }) {
  return <ArtistGuard>{children}</ArtistGuard>;
}
