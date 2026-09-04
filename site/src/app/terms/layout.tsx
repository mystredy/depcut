import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";

export const metadata: Metadata = {
  alternates: {
    canonical: `${DEPCUT_CANONICAL}/terms`,
  },
  description: "Read the DepCut terms of use.",
  title: "Terms of Use | DepCut",
};

type Props = {
  children: ReactNode;
};

export default function TermsLayout({ children }: Props) {
  return children;
}
