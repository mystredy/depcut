import { AppearanceSection } from "./AppearanceSection";
import { BrandingSection } from "./BrandingSection";
import { LegalLinksSection } from "./LegalLinksSection";
import { LocalizationSection } from "./LocalizationSection";
import { PlatformStatusSection } from "./PlatformStatusSection";
import { SiteInfoSection } from "./SiteInfoSection";
import { SystemSection } from "./SystemSection";
import { UserAccessSection } from "./UserAccessSection";

export default function AdminGeneralSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Website-wide identity and platform settings that affect the whole app.
        </p>
      </div>

      <BrandingSection />
      <SiteInfoSection />
      <LocalizationSection />
      <UserAccessSection />
      <AppearanceSection />
      <LegalLinksSection />
      <SystemSection />
      <PlatformStatusSection />
    </div>
  );
}
