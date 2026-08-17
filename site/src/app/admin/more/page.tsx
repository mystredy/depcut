"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Construction } from "lucide-react";

// Shared landing spot for every admin nav item that doesn't have a real page
// yet — an honest "not built" state instead of a dead link. Once a section
// gets built for real, its nav entry moves off this shared route.
export default function AdminComingSoonPage() {
  return (
    <Suspense>
      <ComingSoonContent />
    </Suspense>
  );
}

function ComingSoonContent() {
  const topic = useSearchParams().get("topic") ?? "This section";

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-16 text-center">
      <Construction className="size-6 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{topic}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Not built yet. This nav entry is a placeholder until this section has a real page
          behind it.
        </p>
      </div>
    </div>
  );
}
