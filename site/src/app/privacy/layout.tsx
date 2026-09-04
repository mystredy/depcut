import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";

export const metadata: Metadata = {
  alternates: {
    canonical: `${DEPCUT_CANONICAL}/privacy`,
  },
  description: "Read the DepCut privacy policy.",
  title: "Privacy Policy | DepCut",
};

type Props = {
  children: ReactNode;
};

export default function PrivacyLayout({ children }: Props) {
  return children;
}
