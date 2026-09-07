import { CreditsSection } from "./CreditsSection";
import { UserCreditsTable } from "./UserCreditsTable";

export default function AdminAiCreditsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The pay-as-you-go credits balance: how it's priced, and who has how much.
        </p>
      </div>

      <CreditsSection />
      <UserCreditsTable />
    </div>
  );
}
