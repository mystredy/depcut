import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SettingsHeader } from "@/app/cut/app/(home)/settings/SettingsHeader";
import { SettingsGuard } from "@/cut/components/SettingsGuard";

export const metadata: Metadata = {
  title: "Settings | DepCut",
  description: "Manage your DepCut subscription, credits, and usage.",
};

// Billing and Usage render inside the Cut app shell (the home layout's
// sidebar); the account menu in the sidebar footer is how users get here.
// The whole pane is the scroll container, so the scrollbar spans it top to
// bottom; the title stays pinned by being sticky inside it. Pages still pick
// their behavior: billing overflows and scrolls the pane, usage fills the
// remaining height exactly (flex-1 + h-full chain) and scrolls only its table
// body. py-px gives the cards' outside ring a pixel of room so the scroll
// container can't clip their top border.
export default function CutSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsGuard>
      <div className="flex h-full flex-col overflow-y-auto">
        <SettingsHeader />
        <div className="mx-auto h-full min-h-0 w-full max-w-6xl flex-1 px-10 py-px">
          {children}
        </div>
      </div>
    </SettingsGuard>
  );
}
