import { CreditsSection } from "./CreditsSection";

export default function AdminAiCreditsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How the pay-as-you-go balance displays as &quot;credits&quot; — a display-only
          conversion. Stripe still charges and the ledger still stores real dollars; this
          only sets the number shown on screen.
        </p>
      </div>

      <CreditsSection />
    </div>
  );
}
