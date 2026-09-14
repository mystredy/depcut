"use client";

import { useState } from "react";

import { GradientButton } from "@/app/cut/_components/landing/dark/DarkPrimitives";

// One button between the email link and the unsubscribe, posting to the same
// endpoint mail providers use for one-click.
export function UnsubscribeConfirm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">(
    "idle",
  );

  const unsubscribe = async () => {
    if (state === "pending") return;
    setState("pending");
    const response = await fetch(
      `/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
    setState(response.ok ? "done" : "error");
  };

  if (state === "done") {
    return (
      <p>
        You&apos;re unsubscribed from product emails. You can turn them back on
        any time from Settings in the app.
      </p>
    );
  }

  return (
    <>
      <p>
        Stop receiving product news and announcements from DepCut? Emails
        about your account, like billing and security, keep arriving either way.
      </p>
      <GradientButton onClick={unsubscribe} ariaLabel={state === "pending" ? "Unsubscribing…" : "Unsubscribe"}>
        {state === "pending" ? "Unsubscribing…" : "Unsubscribe"}
      </GradientButton>
      {state === "error" && (
        <p className="text-rose-300">That didn&apos;t go through — try again.</p>
      )}
    </>
  );
}
