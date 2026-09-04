import type { Metadata } from "next";

import { AuthScreen } from "@/app/_components/landing/AuthScreen";

export const metadata: Metadata = {
  title: "Log in | DepCut",
  description: "Log in to DepCut with Google.",
};

export default function Page() {
  return <AuthScreen mode="sign-in" />;
}
