import type { ReactNode } from "react";

import { PayoutsGuard } from "@/cut/components/PayoutsGuard";

export default function PayoutsLayout({ children }: { children: ReactNode }) {
  return <PayoutsGuard>{children}</PayoutsGuard>;
}
