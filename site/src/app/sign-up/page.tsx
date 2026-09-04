import type { Metadata } from "next";

import { AuthScreen } from "@/app/_components/landing/AuthScreen";

export const metadata: Metadata = {
  title: "Sign up | DepCut",
  description: "Create a DepCut account with Google.",
};

export default function Page() {
  return <AuthScreen mode="sign-up" />;
}
