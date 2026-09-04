import type { Metadata } from "next";

import { Footer } from "@/app/_components/landing/Footer";
import { TopNav } from "@/app/_components/landing/TopNav";
import { ApiSection } from "@/app/depcutvision/ApiSection";
import { HeroSection } from "@/app/depcutvision/HeroSection";
import { MediaSection } from "@/app/depcutvision/MediaSection";
import { PricingSection } from "@/app/depcutvision/PricingSection";
import { ProofSection } from "@/app/depcutvision/ProofSection";
import { UseCasesSection } from "@/app/depcutvision/UseCasesSection";
import { VisionCompareSection } from "@/app/depcutvision/VisionCompareSection";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "OmniParser API for UI Element Detection | DepCut Vision",
  description:
    "DepCut Vision is a fast, OmniParser-compatible API for detecting interactable UI elements in screenshots — bounding boxes, center points, and labels.",
  keywords: [
    "OmniParser API",
    "OmniParser",
    "OmniParser-compatible API",
    "UI element detection API",
    "screenshot UI parsing API",
    "computer use vision API",
    "DepCut Vision",
  ],
  alternates: {
    canonical: "https://depcut.com/depcutvision",
  },
  openGraph: {
    type: "website",
    url: "https://depcut.com/depcutvision",
    siteName: "DepCut",
    title: "OmniParser API for UI Element Detection | DepCut Vision",
    description:
      "DepCut Vision is a fast, OmniParser-compatible API for detecting interactable UI elements in screenshots — bounding boxes, center points, and labels.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OmniParser API for UI Element Detection | DepCut Vision",
    description:
      "DepCut Vision is a fast, OmniParser-compatible API for detecting interactable UI elements in screenshots — bounding boxes, center points, and labels.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebAPI",
  name: "DepCut Vision",
  alternateName: "OmniParser API",
  url: "https://depcut.com/depcutvision",
  description:
    "DepCut Vision is a fast, OmniParser-compatible API for detecting interactable UI elements in screenshots — bounding boxes, center points, and labels.",
  provider: {
    "@type": "Organization",
    name: "DepCut",
    url: "https://depcut.com",
  },
};

export default function DepCutVisionPage() {
  return (
    <main className="min-h-screen w-full overflow-x-clip bg-[#F5EFE0] font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#0F0E0D]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <TopNav wordmark="DepCut Vision" />
      <HeroSection />
      <ProofSection />
      <VisionCompareSection />
      <ApiSection />
      <UseCasesSection />
      <MediaSection />
      <PricingSection />
      <Footer />
    </main>
  );
}
